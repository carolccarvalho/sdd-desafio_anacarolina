const NUMBER_PATTERN = /-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/y;

/**
 * Faz parsing estrutural sem converter números para Number. T-003C poderá
 * percorrer o resultado e converter cada nó { type: 'number', lexeme } para
 * DecimalInterno no ponto de entrada monetário apropriado.
 */
export function parseJsonLexical(text) {
  if (typeof text !== 'string') throw new TypeError('JSON deve ser texto');
  const parser = new Parser(text);
  const value = parser.parseValue();
  parser.skipWhitespace();
  if (!parser.atEnd()) parser.error('conteúdo após o valor raiz');
  return value;
}

class Parser {
  constructor(text) { this.text = text; this.index = 0; }

  atEnd() { return this.index >= this.text.length; }
  peek() { return this.text[this.index]; }
  skipWhitespace() { while (/\s/.test(this.peek() ?? '')) this.index += 1; }
  error(message) { throw new SyntaxError(`${message} na posição ${this.index}`); }

  parseValue() {
    this.skipWhitespace();
    const character = this.peek();
    if (character === '{') return this.parseObject();
    if (character === '[') return this.parseArray();
    if (character === '"') return this.parseString();
    if (character === 't') return this.parseLiteral('true', true);
    if (character === 'f') return this.parseLiteral('false', false);
    if (character === 'n') return this.parseLiteral('null', null);
    if (character === '-' || /\d/.test(character ?? '')) return this.parseNumber();
    this.error('valor JSON esperado');
  }

  parseObject() {
    this.index += 1;
    const result = {};
    this.skipWhitespace();
    if (this.peek() === '}') { this.index += 1; return result; }
    while (true) {
      this.skipWhitespace();
      if (this.peek() !== '"') this.error('chave de objeto deve ser string');
      const key = this.parseString();
      this.skipWhitespace();
      if (this.peek() !== ':') this.error('dois-pontos esperado após chave');
      this.index += 1;
      result[key] = this.parseValue();
      this.skipWhitespace();
      if (this.peek() === '}') { this.index += 1; return result; }
      if (this.peek() !== ',') this.error('vírgula esperada entre propriedades');
      this.index += 1;
    }
  }

  parseArray() {
    this.index += 1;
    const result = [];
    this.skipWhitespace();
    if (this.peek() === ']') { this.index += 1; return result; }
    while (true) {
      result.push(this.parseValue());
      this.skipWhitespace();
      if (this.peek() === ']') { this.index += 1; return result; }
      if (this.peek() !== ',') this.error('vírgula esperada entre itens');
      this.index += 1;
    }
  }

  parseString() {
    this.index += 1;
    let result = '';
    while (!this.atEnd()) {
      const character = this.text[this.index++];
      if (character === '"') return result;
      if (character === '\\') {
        const escape = this.text[this.index++];
        const escapes = { '"': '"', '\\': '\\', '/': '/', b: '\b', f: '\f', n: '\n', r: '\r', t: '\t' };
        if (escape === 'u') {
          const hexadecimal = this.text.slice(this.index, this.index + 4);
          if (!/^[0-9a-fA-F]{4}$/.test(hexadecimal)) this.error('escape Unicode inválido');
          result += String.fromCharCode(parseInt(hexadecimal, 16));
          this.index += 4;
        } else if (Object.hasOwn(escapes, escape)) result += escapes[escape];
        else this.error('escape de string inválido');
      } else {
        if (character < ' ') this.error('caractere de controle em string');
        result += character;
      }
    }
    this.error('string não terminada');
  }

  parseLiteral(literal, value) {
    if (this.text.slice(this.index, this.index + literal.length) !== literal) this.error(`literal ${literal} inválido`);
    this.index += literal.length;
    return value;
  }

  parseNumber() {
    NUMBER_PATTERN.lastIndex = this.index;
    const match = NUMBER_PATTERN.exec(this.text);
    if (!match) this.error('número JSON inválido');
    const lexeme = match[0];
    this.index += lexeme.length;
    const next = this.peek();
    if (next !== undefined && /[A-Za-z0-9_.+-]/.test(next)) this.error('número JSON malformado');
    return { type: 'number', lexeme };
  }
}
