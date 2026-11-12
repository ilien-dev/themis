const B = String.raw `(?<![\p{L}\p{N}_=-])`;
const E = String.raw `(?![\p{L}\p{N}_=-])`;
const rule = (id, tool, key, value, ...phrases) => ({
    id, tool, key, value, pattern: new RegExp(`${B}(?:${phrases.join('|')})${E}`, 'iu'),
});
const NOT = String.raw `(?:do\s+not|don['’]t|dont|never)`;
const NO_ES = String.raw `(?:no\s+(?:uses|pongas|a(?:ñ|n)adas)|nunca\s+(?:uses|pongas))`;
const SEMI = String.raw `(?:semicolons?|semi-colons?)`;
const SEMI_ES = String.raw `(?:el\s+)?(?:punto\s+y\s+coma|puntos\s+y\s+coma)`;
const SEMI_ON = [String.raw `(?:use|require|add|end\s+(?:statements|lines)\s+with)\s+${SEMI}`, String.raw `(?:usa|usar|utiliza|utilizar|pon|a(?:ñ|n)ade|exige)\s+${SEMI_ES}`];
const SEMI_OFF = [
    String.raw `(?:avoid|omit|skip|no|${NOT}\s+(?:use|add|write|put))\s+${SEMI}`,
    String.raw `(?:evita|omite|sin|${NO_ES})\s+${SEMI_ES}`,
];
const SINGLE = [String.raw `(?:use|prefer|enable)\s+single\s+quotes?`, String.raw `(?:usa|usar|utiliza|prefiere)\s+comillas\s+simples`];
const DOUBLE = [String.raw `(?:use|prefer|enable)\s+double\s+quotes?`, String.raw `(?:usa|usar|utiliza|prefiere)\s+comillas\s+dobles`];
const TABS = [String.raw `indent\s+(?:with|using)\s+tabs`, String.raw `use\s+tabs\s+(?:for|to)\s+indent(?:ation)?`, String.raw `indenta\s+con\s+tabulaciones`, String.raw `usa\s+tabulaciones\s+para\s+(?:la\s+)?indentaci(?:ó|o)n`];
const SPACES = [String.raw `indent\s+(?:with|using)\s+spaces`, String.raw `use\s+spaces\s+(?:for|to)\s+indent(?:ation)?`, String.raw `indenta\s+con\s+espacios`, String.raw `usa\s+espacios\s+para\s+(?:la\s+)?indentaci(?:ó|o)n`];
// "Indent with 2 spaces", "2-space indentation", "Indenta con 2 espacios".
const spaces = (n) => [
    String.raw `indent(?:ation)?\s+(?:with|using|of)\s+${n}\s+spaces?`, String.raw `${n}[\s-]spaces?\s+indent(?:ation)?`, String.raw `indenta\s+con\s+${n}\s+espacios`,
];
const tabWidth = (n) => [
    String.raw `(?:set\s+)?tab\s*width\s+(?:to\s+|of\s+|is\s+)?${n}`, String.raw `ancho\s+de\s+tabulaci(?:ó|o)n\s+(?:de\s+|a\s+)?${n}`,
];
const lineWidth = (n) => [
    String.raw `(?:max(?:imum)?\s+)?(?:line|print)\s+(?:width|length)\s+(?:of\s+|to\s+|is\s+)?${n}`,
    String.raw `ancho\s+m(?:á|a)ximo\s+de\s+l(?:í|i)nea\s+(?:de\s+)?${n}`,
];
const lineEnding = (names) => [
    String.raw `(?:use\s+)?(?:${names})\s+(?:line\s+endings|newlines)`, String.raw `(?:finales|saltos)\s+de\s+l(?:í|i)nea\s+(?:${names})`,
];
export const LINT_MAP = [
    rule('semi-on', 'prettier', 'prettier.semi', true, ...SEMI_ON),
    rule('semi-off', 'prettier', 'prettier.semi', false, ...SEMI_OFF),
    rule('single-quote-on', 'prettier', 'prettier.singleQuote', true, ...SINGLE),
    rule('single-quote-off', 'prettier', 'prettier.singleQuote', false, ...DOUBLE),
    rule('tab-width-2', 'prettier', 'prettier.tabWidth', 2, ...tabWidth(2)),
    rule('tab-width-4', 'prettier', 'prettier.tabWidth', 4, ...tabWidth(4)),
    rule('use-tabs-on', 'prettier', 'prettier.useTabs', true, ...TABS),
    rule('use-tabs-off', 'prettier', 'prettier.useTabs', false, ...SPACES),
    rule('trailing-comma-on', 'prettier', 'prettier.trailingComma', ['all', 'es5'], String.raw `(?:use|add|require)\s+trailing\s+commas?`, String.raw `(?:usa|usar|utiliza|a(?:ñ|n)ade|exige)\s+comas\s+finales`),
    rule('trailing-comma-off', 'prettier', 'prettier.trailingComma', 'none', String.raw `(?:no|avoid|omit|${NOT}\s+(?:use|add))\s+trailing\s+commas?`, String.raw `(?:evita|omite|sin|${NO_ES})\s+comas\s+finales`),
    rule('print-width-80', 'prettier', 'prettier.printWidth', 80, ...lineWidth(80)),
    rule('print-width-100', 'prettier', 'prettier.printWidth', 100, ...lineWidth(100)),
    rule('print-width-120', 'prettier', 'prettier.printWidth', 120, ...lineWidth(120)),
    rule('indent-style-tab', 'editorconfig', 'editorconfig.indent_style', 'tab', ...TABS),
    rule('indent-style-space', 'editorconfig', 'editorconfig.indent_style', 'space', ...SPACES),
    rule('indent-size-2', 'editorconfig', 'editorconfig.indent_size', '2', ...spaces(2)),
    rule('indent-size-4', 'editorconfig', 'editorconfig.indent_size', '4', ...spaces(4)),
    rule('indent-2-is-spaces', 'editorconfig', 'editorconfig.indent_style', 'space', ...spaces(2)),
    rule('indent-4-is-spaces', 'editorconfig', 'editorconfig.indent_style', 'space', ...spaces(4)),
    rule('end-of-line-lf', 'editorconfig', 'editorconfig.end_of_line', 'lf', ...lineEnding('lf|unix')),
    rule('end-of-line-crlf', 'editorconfig', 'editorconfig.end_of_line', 'crlf', ...lineEnding('crlf|windows')),
    rule('ts-strict', 'tsc', 'tsconfig.strict', true, String.raw `(?:enable|turn\s+on|activate)\s+(?:typescript\s+)?strict\s+mode`, String.raw `use\s+typescript\s+strict\s+mode`, String.raw `(?:habilita|activa)\s+(?:el\s+)?modo\s+estricto(?:\s+de\s+typescript)?`),
    rule('ts-no-implicit-any', 'tsc', 'tsconfig.noImplicitAny', true, String.raw `(?:enable|use|enforce|turn\s+on)\s+noImplicitAny`, String.raw `(?:no|disallow|forbid|avoid|${NOT}\s+(?:allow|use))\s+implicit\s+any(?:s|\s+types?)?`, String.raw `(?:evita|prohibe|no\s+permitas)\s+any\s+impl(?:í|i)citos?`),
    rule('ts-no-unused-locals', 'tsc', 'tsconfig.noUnusedLocals', true, String.raw `(?:enable|use|enforce|turn\s+on)\s+noUnusedLocals`, String.raw `(?:no|disallow|avoid|remove)\s+unused\s+(?:local\s+)?variables`, String.raw `(?:evita|elimina)\s+variables\s+(?:locales\s+)?(?:sin\s+usar|no\s+usadas)`),
    rule('eslint-quotes-single', 'eslint', 'eslint.rules.quotes', 'single', ...SINGLE),
    rule('eslint-quotes-double', 'eslint', 'eslint.rules.quotes', 'double', ...DOUBLE),
    rule('eslint-semi-always', 'eslint', 'eslint.rules.semi', 'always', ...SEMI_ON),
    rule('eslint-semi-never', 'eslint', 'eslint.rules.semi', 'never', ...SEMI_OFF),
    rule('eslint-no-var', 'eslint', 'eslint.rules.no-var', 'on', String.raw `(?:avoid|no|${NOT}\s+use)\s+var`, String.raw `use\s+(?:const|let)\s+(?:and\s+(?:const|let)\s+)?(?:instead\s+of|rather\s+than|not)\s+var`, String.raw `(?:evita|${NO_ES})\s+var`, String.raw `usa\s+(?:const|let)\s+(?:y\s+(?:const|let)\s+)?en\s+(?:vez|lugar)\s+de\s+var`),
    rule('eslint-prefer-const', 'eslint', 'eslint.rules.prefer-const', 'on', String.raw `(?:prefer|use)\s+const(?:\s+(?:over|instead\s+of|rather\s+than)\s+let)?`, String.raw `(?:prefiere|usa)\s+const(?:\s+en\s+(?:vez|lugar)\s+de\s+let)?`),
    rule('eslint-eqeqeq', 'eslint', 'eslint.rules.eqeqeq', 'always', String.raw `(?:use|prefer)\s+===(?:\s+(?:instead\s+of|rather\s+than|over|not)\s+==)?`, String.raw `(?:use|prefer)\s+strict\s+equality`, String.raw `(?:avoid|${NOT}\s+use)\s+(?:loose\s+equality|==)`, String.raw `(?:usa|prefiere)\s+(?:===|igualdad\s+estricta)`),
    rule('eslint-no-console', 'eslint', 'eslint.rules.no-console', 'on', String.raw `(?:avoid|no|remove|${NOT}\s+(?:use|leave))\s+console\.log(?:s|\s+calls?|\s+statements?)?`, String.raw `(?:evita|elimina|${NO_ES})\s+console\.log`),
    rule('commitlint-conventional', 'commitlint', 'commitlint.extends', 'conventional', String.raw `(?:commit\s+messages?\s+(?:must|should|need\s+to)\s+(?:follow|use)|use|follow|adopt|write\s+commits\s+(?:in|with))\s+(?:the\s+)?conventional\s+commits?(?:\s+(?:format|style|convention|specification|spec))?`, String.raw `(?:usa|utiliza|sigue|escribe\s+commits\s+con)\s+(?:los\s+)?(?:conventional\s+commits|commits\s+convencionales)`),
];
