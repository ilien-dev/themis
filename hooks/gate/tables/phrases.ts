// Phrases that say nothing a model needs to be told (question 3). Every pattern is linear-time:
// no nested quantifiers, and every repetition is bounded or consumes a distinct separator.

export interface Phrase {
  readonly pattern: RegExp;
  readonly group: 'generic' | 'filler' | 'vendor';
  readonly source?: { readonly url: string; readonly models: readonly string[]; readonly retrieved: string }; // required for vendor
}

const BEFORE = String.raw`(?<![\p{L}\p{N}_-])`;
const AFTER = String.raw`(?![\p{L}\p{N}_-])`;
const make = (src: string): RegExp => new RegExp(`${BEFORE}(?:${src})${AFTER}`, 'iu');
const generic = (src: string): Phrase => ({ pattern: make(src), group: 'generic' });
const filler = (src: string): Phrase => ({ pattern: make(src), group: 'filler' });
const vendor = (src: string, url: string, models: readonly string[]): Phrase => ({
  pattern: make(src), group: 'vendor', source: { url, models, retrieved: '2026-11-12' },
});

const APOS = "['’]";
const ADJ = 'clean|readable|maintainable|simple|good|high[- ]quality|well[- ]structured|elegant';
const ADJ_ES = 'limpio|legible|mantenible|simple|bueno|de (?:alta )?calidad|elegante';
// "clean, readable and maintainable": each repetition starts with its own separator.
const ADJ_LIST = String.raw`(?:${ADJ})(?:(?:,\s*(?:and\s+)?|\s+and\s+)(?:${ADJ})){0,4}`;
const ADJ_LIST_ES = String.raw`(?:${ADJ_ES})(?:(?:,\s*(?:y\s+)?|\s+y\s+)(?:${ADJ_ES})){0,4}`;
const LANG_WORD = String.raw`[\p{L}\p{N}.+#]{1,24}`;

const BP = 'https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices';
const OPUS_55 = 'https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-opus-5-5';

export const PHRASES: readonly Phrase[] = [
  // Vendor-declared: a current Anthropic guide asks to remove them and no OpenAI guide recommends them.
  // "Manual chain-of-thought prompting ... rely on thinking instead" (models as the note names them).
  vendor(String.raw`think\s+step[- ]by[- ]step(?:\s+before\s+(?:(?:making|you\s+make)\s+(?:any\s+)?changes|answering|you\s+answer|responding|acting|coding))?`, BP,
    ['claude-fable-5-2', 'claude-fable-5-1', 'claude-opus-5-5', 'claude-sonnet-5-5']),
  vendor(String.raw`(?:piensa|razona|ve)\s+paso\s+a\s+paso(?:\s+antes\s+de\s+(?:hacer\s+(?:cualquier\s+)?cambios?|responder|actuar|programar))?`, BP,
    ['claude-fable-5-2', 'claude-fable-5-1', 'claude-opus-5-5', 'claude-sonnet-5-5']),
  // "instructions that tell Claude to think carefully before answering, consider removing them"
  vendor(String.raw`think\s+(?:very\s+)?carefully(?:\s+before\s+(?:answering|you\s+answer|responding|acting|making\s+(?:any\s+)?changes))?`, OPUS_55, ['claude-opus-5-5']),
  vendor(String.raw`piensa\s+(?:muy\s+)?(?:con\s+cuidado|cuidadosamente|detenidamente)(?:\s+antes\s+de\s+(?:responder|actuar|hacer\s+(?:cualquier\s+)?cambios?))?`, OPUS_55, ['claude-opus-5-5']),

  // Generic advice, English.
  generic(String.raw`(?:always\s+)?write\s+(?:${ADJ_LIST})\s+code`),
  generic(String.raw`(?:always\s+)?(?:handle|catch)\s+(?:all\s+)?errors?(?:\s+(?:properly|correctly|gracefully|appropriately))?`),
  generic(String.raw`(?:always\s+)?use\s+(?:meaningful|descriptive|clear|good)\s+(?:variable\s+|function\s+)?names`),
  generic(String.raw`(?:always\s+)?double[- ]check\s+your\s+(?:work|changes|code)(?:\s+before\s+(?:finishing|you\s+finish|committing|submitting|you\s+submit))?`),
  generic(String.raw`(?:always\s+)?follow\s+(?:the\s+)?(?:best|standard|common|industry)\s+(?:practices?|conventions)(?:\s+(?:for|in)\s+${LANG_WORD})?`),
  generic(String.raw`(?:always\s+)?keep\s+(?:your\s+)?(?:functions|methods|classes|files)\s+(?:small|short)(?:\s+and\s+focused)?`),
  generic(String.raw`(?:always\s+)?write\s+(?:unit\s+)?tests\s+for\s+(?:your|all|the)\s+(?:code|changes)`),
  generic(String.raw`(?:always\s+)?be\s+(?:thorough|careful)(?:\s+and\s+(?:thorough|careful))?`),
  generic(String.raw`(?:always\s+)?use\s+(?:modern|latest|recent)\s+${LANG_WORD}\s+(?:features|syntax)`),
  generic(String.raw`(?:always\s+)?use\s+(?:proper\s+)?(?:${LANG_WORD}\s+)?types`),
  generic(String.raw`(?:always\s+)?(?:remember\s+to\s+)?keep\s+(?:the\s+)?(?:code\s+quality|quality\s+of\s+the\s+code)\s+high`),
  generic(String.raw`(?:always\s+)?(?:remember\s+to\s+)?communicate\s+(?:clearly|well)(?:\s+(?:about|on)\s+(?:your\s+|the\s+)?changes)?`),
  generic(String.raw`(?:always\s+)?stay\s+(?:in|within)\s+scope`),
  generic(String.raw`(?:always\s+)?read\s+(?:a\s+|the\s+)?files?\s+before\s+(?:editing|modifying|changing)(?:\s+(?:it|them))?`),
  generic(String.raw`(?:always\s+)?reuse\s+existing\s+code`),
  generic(String.raw`(?:never|do\s+not|don${APOS}t)\s+edit\s+(?:the\s+)?tests\s+to\s+(?:make\s+(?:them|it)\s+)?pass`),
  generic(String.raw`(?:always\s+)?(?:reply|respond|answer)\s+in\s+the\s+(?:configured|user${APOS}s)\s+language`),
  // Generic advice, Spanish.
  generic(String.raw`(?:siempre\s+)?escribe\s+(?:un\s+)?c\u00f3digo\s+(?:${ADJ_LIST_ES})`),
  generic(String.raw`(?:siempre\s+)?(?:maneja|gestiona)\s+(?:bien\s+)?(?:todos\s+)?(?:los\s+)?errores(?:\s+(?:correctamente|adecuadamente|bien))?`),
  generic(String.raw`(?:siempre\s+)?usa\s+nombres\s+(?:de\s+variables?\s+)?(?:significativos|descriptivos|claros)`),
  generic(String.raw`(?:siempre\s+)?(?:revisa|comprueba)\s+(?:dos\s+veces\s+)?tu\s+(?:trabajo|c\u00f3digo)(?:\s+antes\s+de\s+(?:terminar|entregar))?`),
  generic(String.raw`(?:siempre\s+)?sigue\s+las\s+mejores\s+pr\u00e1cticas(?:\s+(?:de|en)\s+${LANG_WORD})?`),
  generic(String.raw`(?:siempre\s+)?mant\u00e9n\s+las\s+funciones\s+(?:peque\u00f1as|cortas)(?:\s+y\s+enfocadas)?`),
  generic(String.raw`(?:siempre\s+)?escribe\s+(?:pruebas|tests)\s+para\s+tu\s+c\u00f3digo`),
  generic(String.raw`(?:siempre\s+)?s\u00e9\s+(?:minucioso|cuidadoso)(?:\s+y\s+(?:minucioso|cuidadoso))?`),
  generic(String.raw`(?:siempre\s+)?(?:recuerda\s+)?mant\u00e9n\s+(?:alta\s+)?la\s+calidad\s+del\s+c\u00f3digo(?:\s+alta)?`),
  generic(String.raw`(?:siempre\s+)?(?:recuerda\s+)?comun\u00edcate\s+(?:claramente|bien)(?:\s+sobre\s+(?:tus|los)\s+cambios)?`),

  // File filler: sentences about the file itself.
  filler(String.raw`this\s+file\s+(?:gives|provides)\s+(?:[^\s.,;:!?]+\s+){0,3}?(?:context|guidance)(?:\s+(?:about|on|for)\s+(?:the\s+)?[^\s.,;:!?]{1,40}(?:\s+project)?)?(?:\s+so\s+(?:that\s+)?(?:it|claude|you)\s+can\s+(?:help|work|assist)(?:\s+(?:effectively|better|well))?)?`),
  filler(String.raw`keep\s+(?:it|this\s+file)\s+(?:up[- ]to[- ]date|updated|current)(?:\s+as\s+(?:the\s+)?project\s+(?:evolves|changes|grows))?`),
  filler(String.raw`este\s+archivo\s+(?:da|proporciona|ofrece|contiene)\s+(?:[^\s.,;:!?]+\s+){0,3}?(?:contexto|orientaci\u00f3n|gu\u00eda)(?:\s+(?:sobre|acerca\s+de)\s+(?:el\s+|la\s+)?(?:proyecto\s+)?[^\s.,;:!?]{1,40}(?:\s+proyecto)?)?(?:\s+para\s+que\s+(?:pueda|puedas)\s+ayudar(?:\s+(?:bien|mejor|eficazmente))?)?`),
  filler(String.raw`mant(?:\u00e9n|en)(?:lo|\s+este\s+archivo)\s+actualizado(?:\s+a\s+medida\s+que\s+(?:el\s+)?proyecto\s+(?:evoluciona|cambia|crece))?`),
];
