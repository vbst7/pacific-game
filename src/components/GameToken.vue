<template>
  <div 
    class="relative rounded-full flex items-center justify-center shadow-md border-2 border-white/20 transition-transform hover:scale-110"
    :class="containerSize"
    :style="{ backgroundColor: tokenStyles[type]?.bg || '#cbd5e1' }"
  >
    <svg 
      viewBox="0 0 100 100" 
      class="w-3/4 h-3/4"
      fill="none" 
      stroke="currentColor" 
      stroke-width="4"
      stroke-linecap="round" 
      stroke-linejoin="round"
      :class="tokenStyles[type]?.textClass || 'text-slate-900'"
    >
      <!-- FISH (Nature) -->
      <g v-if="type === 'fish'">
        <path d="M10,50 C10,30 40,20 70,35 L90,20 L90,80 L70,65 C40,80 10,70 10,50 Z" fill="currentColor" fill-opacity="0.1" />
        <circle cx="25" cy="45" r="3" fill="currentColor" />
        <path d="M70,35 Q55,50 70,65" />
      </g>

      <!-- HOTEL (Business) -->
      <g v-if="type === 'hotel'">
        <path d="M20,80 L20,40 L50,15 L80,40 L80,80 Z" fill="currentColor" fill-opacity="0.1" />
      </g>

      <!-- BOAT (Transit) -->
      <g v-if="type === 'boat'">
        <path d="M15,65 Q50,90 85,65 L75,85 L25,85 Z" fill="currentColor" />
        <path d="M50,60 L50,20 L80,55 Z" stroke-width="6" />
        <path d="M45,60 L45,30 L20,55 Z" stroke-width="4" />
      </g>

      <!-- FACTORY (Industry) -->
      <g v-if="type === 'factory'">
        <path d="M15,80 L15,50 L40,70 L40,40 L65,60 L65,30 L85,30 L85,80 Z" fill="currentColor" fill-opacity="0.1" />
        <line x1="15" y1="80" x2="85" y2="80" />
      </g>

      <!-- MONEY (Yellow with Black $) -->
      <g v-if="type === 'money'" stroke-width="8">
        <text x="50" y="72" text-anchor="middle" font-family="Arial, sans-serif" font-weight="900" font-size="60" fill="black" stroke="none">$</text>
      </g>

    <!-- CHIT TOKEN (Multicolor Wheel) -->
    <g v-if="type === 'chit'">
      <!-- White: -90° to -18° -->
      <path d="M50,50 L50,5 A45,45 0 0,1 92.8,35.5 Z" fill="#f8fafc" />
      <!-- Green: -18° to 54° -->
      <path d="M50,50 L92.8,35.5 A45,45 0 0,1 76.3,92.1 Z" fill="#4ade80" />
      <!-- Orange: 54° to 126° -->
      <path d="M50,50 L76.3,92.1 A45,45 0 0,1 23.7,92.1 Z" fill="#fb923c" />
      <!-- Black: 126° to 198° -->
      <path d="M50,50 L23.7,92.1 A45,45 0 0,1 7.2,35.5 Z" fill="#111111" />
      <!-- Blue: 198° to 270° -->
      <path d="M50,50 L7.2,35.5 A45,45 0 0,1 50,5 Z" fill="#3b82f6" />
      <!-- Outer Ring -->
      <circle cx="50" cy="50" r="45" fill="none" stroke="black" stroke-width="2" />
    </g>

    <!-- FISH TOKEN (3 Fish) -->
<g v-if="type === 'hatchery'">

  <!-- Fish 1: top-left, facing right -->
  <g transform="translate(0, 22) scale(0.48)">
    <path d="M10,50 C10,30 40,20 70,35 L90,20 L90,80 L70,65 C40,80 10,70 10,50 Z" fill="white" fill-opacity="0.85" />
    <circle cx="25" cy="45" r="3" fill="#1a1a1a" />
    <path d="M70,35 Q55,50 70,65" fill="none" stroke="white" stroke-opacity="0.5" stroke-width="2" />
  </g>

  <!-- Fish 2: top-right, facing left, slightly offset -->
  <g transform="translate(40, -5) scale(0.48)">
    <path d="M10,50 C10,30 40,20 70,35 L90,20 L90,80 L70,65 C40,80 10,70 10,50 Z" fill="white" fill-opacity="0.85" />
    <circle cx="25" cy="45" r="3" fill="#1a1a1a" />
    <path d="M70,35 Q55,50 70,65" fill="none" stroke="white" stroke-opacity="0.5" stroke-width="2" />
  </g>

  <!-- Fish 3: bottom-center, facing left -->
  <g transform="translate(28, 56) scale(0.48)">
    <path d="M10,50 C10,30 40,20 70,35 L90,20 L90,80 L70,65 C40,80 10,70 10,50 Z" fill="white" fill-opacity="0.85" />
    <circle cx="25" cy="45" r="3" fill="#1a1a1a" />
    <path d="M70,35 Q55,50 70,65" fill="none" stroke="white" stroke-opacity="0.5" stroke-width="2" />
  </g>
</g>

<!-- PORT (Transit) -->
<g v-if="type === 'port'" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round">
  <!-- Top circle -->
  <circle cx="50" cy="22" r="7" />
  <!-- Vertical shaft -->
  <line x1="50" y1="29" x2="50" y2="78" />
  <!-- Horizontal crossbar -->
  <line x1="28" y1="42" x2="72" y2="42" />
  <!-- Curved bottom (U shape) -->
  <path d="M28,42 Q28,78 50,78 Q72,78 72,42" />
  <!-- Left serif -->
  <line x1="22" y1="72" x2="33" y2="72" />
  <!-- Right serif -->
  <line x1="67" y1="72" x2="78" y2="72" />
</g>

<!-- hq TOKEN -->
<g v-if="type === 'hq'">
  <!-- Dark background circle -->
  <circle cx="50" cy="50" r="45" fill="#1a1a1a" />

  <!-- Building: roof (triangle) -->
  <polygon points="50,18 22,38 78,38" fill="#f97316" />

  <!-- Building: main body -->
  <rect x="27" y="38" width="46" height="34" fill="#f97316" />

  <!-- Door cutout -->
  <rect x="39" y="52" width="11" height="20" fill="#1a1a1a" />
  <rect x="50" y="52" width="11" height="20" fill="#1a1a1a" rx="0" />

  <!-- Door as arch or just two panels — simple split -->
  <line x1="50" y1="52" x2="50" y2="72" stroke="#f97316" stroke-width="1.5" />

  <!-- Outer ring -->
  <circle cx="50" cy="50" r="45" fill="none" stroke="#333" stroke-width="2" />
</g>

<!-- DIRECT FLIGHT (Double Arrow) -->
  <g v-if="type === 'direct flight'">
    <line x1="15" y1="50" x2="85" y2="50" stroke-width="10" />
    <path d="M35,25 L15,50 L35,75" fill="none" stroke-width="10" />
    <path d="M65,25 L85,50 L65,75" fill="none" stroke-width="10" />
  </g>

  <!-- BALLOON TOKEN -->
<g v-if="type === 'balloon'">
  <circle cx="50" cy="50" r="45" fill="#1a1a1a" />
  <!-- Balloon envelope -->
  <ellipse cx="50" cy="38" rx="20" ry="24" fill="none" stroke="currentColor" stroke-width="4" />
  <!-- Vertical ribs -->
  <line x1="50" y1="14" x2="50" y2="62" stroke="currentColor" stroke-width="2.5" />
  <!-- Horizontal bands -->
  <line x1="30" y1="32" x2="70" y2="32" stroke="currentColor" stroke-width="2" />
  <line x1="30" y1="44" x2="70" y2="44" stroke="currentColor" stroke-width="2" />
  <!-- Basket -->
  <rect x="40" y="64" width="20" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="3.5" />
  <!-- Ropes -->
  <line x1="44" y1="62" x2="42" y2="64" stroke="currentColor" stroke-width="2" />
  <line x1="56" y1="62" x2="58" y2="64" stroke="currentColor" stroke-width="2" />
  <circle cx="50" cy="50" r="45" fill="none" stroke="#333" stroke-width="2" />
</g>

</svg>
</div>
</template>
<style scoped>
.text-\[\#FFE187\] {
  color: #FFE187 !important;
}
</style>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  type: {
    type: String,
    required: true, // 'fish', 'hotel', 'boat', 'factory', 'money'
  },
  size: {
    type: String,
    default: 'md' // 'sm', 'md', 'lg'
  }
});

const containerSize = computed(() => {
  return {
    'sm': 'w-[18px] h-[18px]',
    'md': 'w-[30px] h-[30px]',
    'lg': 'w-[48px] h-[48px]'
  }[props.size];
});

const tokenStyles = {
  fish:         { bg: '#f1f5f1', textClass: 'text-black' },    // Nature White
  hotel:        { bg: '#3b82f6', textClass: 'text-black' },        // Business Blue
  boat:         { bg: '#4ade80', textClass: 'text-black' },  // Transit Green
  factory:      { bg: '#fb923c', textClass: 'text-black' },   // Industry Orange
  money:        { bg: '#fde047', textClass: 'text-black' },         // Yellow $
  chit:         { bg: '#f8fafc', textClass: 'text-slate-900' },     // Multicolor Wheel
  hatchery:     { bg: '#1a1a1a', textClass: 'text-white' },         // 3 Fish
  port:         { bg: '#1a1a1a', textClass: 'text-emerald-400' },     // Transit Port
  hq:           { bg: '#1a1a1a', textClass: 'text-[#FFE187]' },      // Building
  balloon:      { bg: '#1a1a1a', textClass: 'text-[#FFE187]' },      // Balloon
  'direct flight': { bg: '#1a1a1a', textClass: 'text-white' }        // Double Arrow
};
</script>
