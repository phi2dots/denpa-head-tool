export const shapeTypes = {
  none: "なし",
  rock: "グー",
  scissors: "チョキ",
  paper: "パー",
} as const;

export const statusLabels = {
  hp: "HP",
  ap: "AP",
  attack: "こうげきりょく",
  defense: "ぼうぎょりょく",
  speed: "すばやさ",
  evasion: "かいひりつ",
} as const;

export const elementalLabels = {
  fire: "火",
  ice: "氷",
  wind: "風",
  earth: "土",
  thunder: "雷",
  water: "水",
  light: "光",
  dark: "闇",
  allElements: "ぞくせいたいせい",
} as const;

export const ailmentLabels = {
  poison: "どく",
  burn: "やけど",
  frostbite: "しもやけ",
  cold: "かぜっぴき",
  mud: "どろだらけ",
  shock: "かんでん",
  soaked: "みずびたし",
  blind: "ブラインド",
  curse: "のろい",
  suddenDeath: "とつぜんし",
  paralysis: "マヒ",
  sleep: "ねむり",
  charm: "みりょう",
  fear: "きょうふ",
  jack: "ジャック",
  allAilments: "いじょう",
} as const;

export const specialLabels = {
  goldPercent: "ゴールド",
  expReductionPercent: "必要経験値",
  charmPercent: "ゆうわく",
  fearPercent: "きょうふ",
} as const;
