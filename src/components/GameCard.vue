<template>
  <div
    class="bg-slate-800 flex flex-col overflow-hidden shadow-lg border border-white/10 w-full h-full card-container"
    :class="containerClass"
  >
    <!-- ───────────────────────────────────────────────────────────────
         DEFAULT LAYOUT  (original: header / body / footer)
    ─────────────────────────────────────────────────────────────────── -->
    <template v-if="layout === 'default'">
      <!-- Header -->
      <header :class="headerClass" :style="{ backgroundColor: getCardColor(card.types, 0) }">
        <span :class="nameClass" :style="nameStyle">{{ card.name }}</span>
      </header>
      <!-- Body -->
      <div :class="bodyClass" class="bg-[#d2b48c] text-slate-900 flex flex-col justify-center overflow-hidden">
        <div :class="textClass" class="font-medium leading-tight italic whitespace-pre-wrap">
          <CardTextContent :parts="parsedText" :tokenSize="tokenSize" :tokenClass="tokenClass" />
        </div>
      </div>
      <!-- Footer -->
      <footer :class="footerClass" class="flex overflow-hidden">
        <div
          v-for="(type, i) in card.types"
          :key="i"
          class="flex items-center justify-center"
          :class="typeClass"
          :style="{ backgroundColor: getCardColor(card.types, i), flex: '1 1 0' }"
        >
          {{ type }}
        </div>
      </footer>
    </template>

    <!-- ───────────────────────────────────────────────────────────────
         ILLUSTRATED LAYOUT  (large image, title inside, text below)
    ─────────────────────────────────────────────────────────────────── -->
    <template v-else-if="layout === 'illustrated'">
      <!-- Image area with overlaid title -->
      <div class="relative shrink-0" style="height: 85cqw">
        <!-- Image -->
        <img
          :src="imageUrl"
          :alt="card.name"
          class="absolute inset-0 w-full h-full object-cover"
          draggable="false"
        />

        <!-- Gradient scrim so the title reads clearly -->
        <div
          class="absolute inset-0 w-full"
          style="
            background: linear-gradient(
              to bottom,
              rgba(0,0,0,0.55) 0%,
              rgba(0,0,0,0.15) 45%,
              rgba(0,0,0,0) 100%
            );
          "
        />

        <!-- Title text sitting inside the image, top-aligned -->
        <div class="absolute top-0 left-0 right-0 flex items-start justify-center px-[3cqw] pt-[3cqw]">
          <span
            class="font-black uppercase leading-none text-center drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]"
            :style="nameStyle"
          >
            <span
              v-for="(part, i) in illustratedTitleParts"
              :key="i"
              :style="{ color: part.color, textShadow: '0 1px 4px rgba(0,0,0,0.85)' }"
            >{{ part.text }}</span>
          </span>
        </div>
      </div>

      <!-- Body — same tan card stock feel, smaller padding -->
      <div
        class="flex-1 bg-[#d2b48c] text-slate-900 flex flex-col justify-center overflow-hidden"
        :class="illustratedBodyClass"
      >
        <div :class="illustratedTextClass" :style="illustratedTextStyle" class="font-medium leading-tight italic whitespace-pre-wrap">
          <CardTextContent :parts="parsedText" :tokenSize="tokenSize" :tokenClass="illustratedTokenClass" />
        </div>
      </div>

      <!-- Footer -->
      <footer :class="footerClass" class="flex overflow-hidden">
        <div
          v-for="(type, i) in card.types"
          :key="i"
          class="flex items-center justify-center"
          :class="typeClass"
          :style="{ backgroundColor: getCardColor(card.types, i), flex: '1 1 0' }"
        >
          {{ type }}
        </div>
      </footer>
    </template>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import GameToken from './GameToken.vue';

// ── Props ────────────────────────────────────────────────────────────────────
const props = defineProps({
  card:   { type: Object, required: true },
  size:   { type: String, default: 'md' },      // 'sm' | 'md' | 'lg' | 'xl'
  layout: { type: String, default: 'default' }, // 'default' | 'illustrated'
});

// ── Colour helpers ───────────────────────────────────────────────────────────
const typeColors = {
  'Transit':  '#74C7A2',
  'Business': '#FFE187',
  'Industry': '#EF6A3E',
  'Tourism':  '#298fb4',
  'Nature':   '#e2e8f0',
  'Special':  '#FFA520',
};

const getCardColor = (types, index) => {
  const typeName = types?.[index];
  return typeColors[typeName] || '#1e293b';
};

// ── Text parser ──────────────────────────────────────────────────────────────
const parsedText = computed(() => {
  const text = props.card.text;
  if (!text) return [];
  const regex = /\((fish|hotel|boat|factory|chit|balloon|port|hatchery|direct flight|hq)\)/gi;
  const parts = [];
  let lastIndex = 0;
  let match;

  const areaNames = [
    'Japan','California','CoralSea','Coral Sea','Polynesia','Peru',
    'Anywhere','Anywhere else','Any area.*','Each area.*','Another area.*',
    'another area','any one area','any one other area','An empty area','Next turn',':',
  ];
  const areaRegex = new RegExp(`\\b(${areaNames.join('|')})\\b`, 'g');

  const addTextWithAreas = (txt) => {
    const splitParts = txt.split(areaRegex);
    for (let i = 0; i < splitParts.length; i++) {
      const content = splitParts[i];
      if (!content) continue;
      if (i % 2 === 1) parts.push({ type: 'area', content });
      else             parts.push({ type: 'text', content });
    }
  };

  while ((match = regex.exec(text)) !== null) {
    const precedingText = text.substring(lastIndex, match.index);
    const numberMatch   = precedingText.match(/(\d+)\s*$/);
    if (numberMatch) {
      const textBeforeNumber = precedingText.substring(0, numberMatch.index);
      if (textBeforeNumber.length > 0) addTextWithAreas(textBeforeNumber);
      const count = parseInt(numberMatch[1], 10);
      for (let i = 0; i < count; i++) parts.push({ type: 'token', content: match[1] });
    } else {
      if (precedingText.length > 0) addTextWithAreas(precedingText);
      parts.push({ type: 'token', content: match[1] });
    }
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) addTextWithAreas(text.substring(lastIndex));
  return parts;
});

// ── Shared / Default layout classes ─────────────────────────────────────────
const nameFontSize = computed(() => {
  const baseCqw   = 9.375;
  const len       = props.card.name?.length || 0;
  const threshold = 14;
  if (len <= threshold) return baseCqw;
  return Math.max(baseCqw * (threshold / len), baseCqw * 0.5);
});

const nameStyle      = computed(() => ({ fontSize: `${nameFontSize.value}cqw` }));
const nameClass      = computed(() => 'font-black text-slate-900 uppercase leading-none text-center px-[0.5cqw]');
const headerClass    = computed(() => 'h-[30cqw] px-[2cqw] flex items-center justify-center shadow-sm shrink-0');
const bodyClass      = computed(() => 'p-[10cqw] flex-1 bg-[#d2b48c] text-slate-900 flex flex-col justify-center overflow-hidden');
const footerClass    = computed(() => 'h-[15cqw] shrink-0');
const textClass      = computed(() => 'text-[9.375cqw] font-bold leading-tight italic whitespace-pre-wrap');
const typeClass      = computed(() => 'text-[7.5cqw] font-bold text-slate-800 uppercase tracking-widest truncate');
const tokenClass     = computed(() => '!w-[11cqw] !h-[11cqw]');
const containerClass = computed(() => 'rounded-[0.5cqw]');
const tokenSize      = computed(() => 'md');

// ── Illustrated layout classes ───────────────────────────────────────────────
const illustratedBodyClass  = computed(() => 'p-[6cqw]');
const illustratedTextFontSize = computed(() => {
  const baseCqw   = 8;
  // Treat tokens as 2 characters visually, and count literal characters for text/areas
  const len = parsedText.value.reduce((acc, part) => {
    if (part.type === 'token') return acc + 2;
    return acc + (part.content?.length || 0);
  }, 0);
  const threshold = 60; // Start shrinking after 60 characters
  if (len <= threshold) return baseCqw;
  return Math.max(baseCqw * (threshold / len), baseCqw * 0.6); // Don't shrink below 60% of base size
});
const illustratedTextStyle  = computed(() => ({ fontSize: `${illustratedTextFontSize.value}cqw` }));
const illustratedTextClass  = computed(() => 'font-bold leading-tight italic whitespace-pre-wrap');
const illustratedTokenClass = computed(() => '!w-[9.5cqw] !h-[9.5cqw]');

const imageUrl = computed(() =>
  `/images/cards/${props.card.name.replace(/ /g, '_')}.webp`
);

const illustratedTitleParts = computed(() => {
  const name   = props.card.name;
  const colors = [
    getCardColor(props.card.types, 0),
    getCardColor(props.card.types, props.card.types.length > 1 ? 1 : 0),
  ];
  if (props.card.types.length < 2) return [{ text: name, color: colors[0] }];

  const words = name.split(' ');
  if (words.length >= 2) {
    const mid = Math.floor(words.length / 2);
    return [
      { text: words.slice(0, mid).join(' '),       color: colors[0] },
      { text: ' ' + words.slice(mid).join(' '),    color: colors[1] },
    ];
  }
  // Single word: split at character midpoint
  const mid = Math.floor(name.length / 2);
  return [
    { text: name.slice(0, mid), color: colors[0] },
    { text: name.slice(mid),    color: colors[1] },
  ];
});
</script>

<script>
import { defineComponent, h } from 'vue';
import GameToken from './GameToken.vue';

export const CardTextContent = defineComponent({
  name: 'CardTextContent',
  props: {
    parts:      { type: Array,  required: true },
    tokenSize:  { type: String, default: 'md' },
    tokenClass: { type: String, default: '' },
  },
  render() {
    return this.parts.map((part, pIdx) => {
      if (part.type === 'text') {
        const segments = part.content.split(':');
        return h('span', { key: pIdx },
          segments.flatMap((seg, sIdx) =>
            sIdx > 0
              ? [h('span', { class: 'not-italic' }, ':'), seg]
              : [seg]
          )
        );
      }
      if (part.type === 'area') {
        return h('span', { key: pIdx, class: 'font-black not-italic' }, part.content);
      }
      const isBalloon = part.content === 'balloon';
      return h(
        'span',
        { key: pIdx, class: 'inline-block align-middle translate-y-[-0.15cqw] mx-[0.25cqw]' },
        [h(GameToken, { type: part.content, size: this.tokenSize, class: `!border-none shadow-none inline-flex ${this.tokenClass} ${isBalloon ? 'text-[#FFE187]' : ''}` })]
      );
    });
  },
});
</script>

<style scoped>
.card-container {
  container-type: inline-size;
}
</style>