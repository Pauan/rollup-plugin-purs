use super::ast::{Position, Location, TemplateRaw};
use super::ast;
use std::iter::Peekable;
use std::convert::TryInto;


pub fn hex_to_char(s: &str) -> Option<char> {
    let decoded = match u32::from_str_radix(s, 16) {
        Ok(s) => s,
        // TODO handle things like overflow
        Err(_) => unreachable!(),
    };

    decoded.try_into().ok()
}


// TODO improve this somehow
pub fn format_error(input: &str, filename: Option<&str>, position: Position, message: &str) -> String {
    let (left, right) = input.split_at(position.offset);

    let mut left_chars = left.chars();
    let mut right_chars = right.chars();

    let mut left_index = left.len();
    let mut right_index = 0;

    while let Some(c) = left_chars.next_back() {
        if c == '\n' || c == '\r' {
            break;

        } else {
            left_index -= 1;
        }
    }

    while let Some(c) = right_chars.next() {
        if c == '\n' || c == '\r' {
            break;

        } else {
            right_index += 1;
        }
    }

    format!("{} [{}{}:{}]\n{}{}\n{}^",
        message,
        filename.map(|x| format!("{} ", x)).unwrap_or_else(|| "".to_string()),
        position.line + 1,
        position.column + 1,
        &left[left_index..],
        &right[..right_index],
        "~".repeat(position.column),
    )
}


// https://www.ecma-international.org/ecma-262/10.0/#sec-line-terminators
fn is_newline(c: char) -> bool {
    match c {
        // TODO duplication with process_newline
        '\u{000A}' |
        '\u{2028}' |
        '\u{2029}' |
        '\u{000D}' => true,
        _ => false,
    }
}

// https://www.ecma-international.org/ecma-262/10.0/#prod-IdentifierStart
fn is_identifier_start(c: char) -> bool {
    match c {
        '$' => true,
        '_' => true,
        '\\' => true,
        // TODO use ID_Start instead of XID_Start ?
        c if unicode_xid::UnicodeXID::is_xid_start(c) => true,
        _ => false,
    }
}

// https://www.ecma-international.org/ecma-262/10.0/#prod-IdentifierPart
fn is_identifier_part(c: char) -> bool {
    // '\' is excluded because it's handled in parse_identifier
    match c {
        '$' => true,
        '\u{200C}' => true,
        '\u{200D}' => true,
        // TODO use ID_Continue instead of XID_Continue ?
        c if unicode_xid::UnicodeXID::is_xid_continue(c) => true,
        _ => false,
    }
}


pub type ParseError = String;


#[derive(Debug, Clone, PartialEq)]
pub enum TemplateKind {
    Whole,
    Start,
    Middle,
    End,
}

#[derive(Debug, Clone, PartialEq)]
pub enum Token<'a> {
    Identifier(ast::Identifier<'a>),
    Literal(ast::Literal<'a>),
    Punctuation {
        value: &'a str,
        location: Location,
    },
    Template {
        kind: TemplateKind,
        raw: TemplateRaw<'a>,
    },
    Newline,
}


#[derive(Debug, Clone)]
pub struct TokenStream<'a, 'b> {
    input: &'a str,
    filename: Option<&'b str>,
    stream: Peekable<std::str::Chars<'a>>,
    position: Position,
}

impl<'a, 'b> TokenStream<'a, 'b> {
    pub fn new(input: &'a str, filename: Option<&'b str>) -> Self {
        Self {
            input,
            filename,
            stream: input.chars().peekable(),
            position: Position::default(),
        }
    }

    fn error<A>(&self, start: Position, message: &str) -> Result<A, ParseError> {
        Err(format_error(self.input, self.filename, start, message))
    }

    fn consume_if<F>(&mut self, f: F) -> bool where F: FnOnce(char) -> bool {
        match self.stream.peek() {
            Some(next) if f(*next) => {
                self.stream.next();
                self.position.increment_column();
                true
            },
            Some(_) => false,
            None => false,
        }
    }

    fn consume_while0<F>(&mut self, mut f: F) where F: FnMut(char) -> bool {
        loop {
            if self.consume_if(|c| f(c)) {
                continue;

            } else {
                break;
            }
        }
    }

    fn consume_while1<F>(&mut self, mut f: F) -> bool where F: FnMut(char) -> bool {
        let mut seen = false;

        loop {
            if self.consume_if(|c| f(c)) {
                seen = true;
                continue;

            } else {
                return seen;
            }
        }
    }

    #[inline]
    fn consume_char(&mut self, c: char) -> bool {
        self.consume_if(|next| c == next)
    }

    fn raw_str(&self, start: Position, end: Position) -> &'a str {
        &self.input[start.offset..end.offset]
    }


    // https://www.ecma-international.org/ecma-262/10.0/#sec-line-terminators
    fn process_newline(&mut self, c: char) -> bool {
        match c {
            '\u{000A}' |
            '\u{2028}' |
            '\u{2029}' => {
                self.position.increment_line();
                true
            },
            // \r\n
            '\u{000D}' => {
                if let Some('\u{000A}') = self.stream.peek() {
                    self.stream.next();
                    self.position.offset += 1;
                }

                self.position.increment_line();
                true
            },
            _ => false,
        }
    }

    fn punctuation(&self, start: Position) -> Result<Token<'a>, ParseError> {
        let end = self.position;

        Ok(Token::Punctuation {
            value: self.raw_str(start, end),
            location: Location { start, end },
        })
    }

    fn number(&self, start: Position) -> Result<Token<'a>, ParseError> {
        let end = self.position;

        Ok(Token::Literal(ast::Literal::Number(ast::Number {
            raw_value: self.raw_str(start, end),
            location: Location { start, end },
        })))
    }

    fn error_hex_digit<A>(&self) -> Result<A, ParseError> {
        self.error(self.position, "Expected one of [0 1 2 3 4 5 6 7 8 9 a b c d e f A B C D E F]")
    }

    fn is_number_or_identifier(&mut self) -> bool {
        if let Some(c) = self.stream.peek() {
            if c.is_ascii_digit() || is_identifier_start(*c) {
                return true;
            }
        }

        false
    }


    fn parse_escape(&mut self, start: Position) -> Result<(), ParseError> {
        match self.stream.next() {
            Some('u') => {
                self.position.increment_column();
                self.parse_unicode_escape_sequence()?;
                Ok(())
            },
            // TODO validation for this ?
            Some('x') => {
                self.position.increment_column();
                self.consume_hex_digit()?;
                self.consume_hex_digit()?;
                Ok(())
            },
            Some('0') => {
                self.position.increment_column();

                if let Some(c) = self.stream.peek() {
                    if c.is_ascii_digit() {
                        return self.error(start, "\\0 cannot be followed by a number");
                    }
                }

                Ok(())
            },
            Some(c) => {
                if self.process_newline(c) {
                    Ok(())

                // TODO allow for 8 and 9 ?
                } else if c.is_ascii_digit() {
                    return self.error(start, "\\ cannot be followed by a number");

                } else {
                    self.position.increment_column();
                    Ok(())
                }
            },
            None => {
                return self.error(start, "Missing escape sequence");
            },
        }
    }

    fn parse_string(&mut self, start: Position, delimiter: char) -> Result<Token<'a>, ParseError> {
        loop {
            let char_start = self.position;

            match self.stream.next() {
                Some('\\') => {
                    self.position.increment_column();
                    self.parse_escape(char_start)?;
                    continue;
                },
                Some(c) => {
                    if c == delimiter {
                        self.position.increment_column();

                        let end = self.position;

                        return Ok(Token::Literal(ast::Literal::String(ast::String {
                            raw_value: self.raw_str(start, end),
                            location: Location { start, end }
                        })));

                    } else if self.process_newline(c) {
                        if c == '\n' || c == '\r' {
                            return self.error(char_start, "Strings may not contain newlines unless preceded by \\");

                        // '\u{2028}' | \'u{2029}'
                        } else {
                            continue;
                        }

                    } else {
                        self.position.increment_column();
                        continue;
                    }
                },
                None => {
                    return self.error(start, &format!("Missing ending {}", delimiter));
                },
            }
        }
    }


    fn parse_template(&mut self, start: Position, is_template: bool) -> Result<Token<'a>, ParseError> {
        let part_start = self.position;

        loop {
            let char_start = self.position;

            match self.stream.next() {
                Some('`') => {
                    let part_end = self.position;

                    self.position.increment_column();

                    let end = self.position;

                    return Ok(Token::Template {
                        kind: if is_template { TemplateKind::End } else { TemplateKind::Whole },
                        raw: TemplateRaw {
                            raw_value: self.raw_str(part_start, part_end),
                            location: Location { start, end },
                        },
                    });
                },
                Some('$') => {
                    let part_end = self.position;

                    self.position.increment_column();

                    if self.consume_char('{') {
                        let end = self.position;

                        return Ok(Token::Template {
                            kind: if is_template { TemplateKind::Middle } else { TemplateKind::Start },
                            raw: TemplateRaw {
                                raw_value: self.raw_str(part_start, part_end),
                                location: Location { start, end },
                            },
                        });

                    } else {
                        self.position.increment_column();
                        continue;
                    }
                },
                Some('\\') => {
                    self.position.increment_column();

                    match self.stream.next() {
                        Some(c) => {
                            if self.process_newline(c) {
                                continue;

                            } else {
                                self.position.increment_column();
                                continue;
                            }
                        },
                        None => {
                            return self.error(char_start, "Missing escape sequence");
                        },
                    }
                },
                Some(c) => {
                    if self.process_newline(c) {
                        continue;

                    } else {
                        self.position.increment_column();
                        continue;
                    }
                },
                None => {
                    return self.error(start, "Missing ending `");
                },
            }
        }
    }


    fn parse_regexp(&mut self, start: Position) -> Result<Token<'a>, ParseError> {
        let pattern_start = self.position;

        loop {
            let char_start = self.position;

            match self.stream.next() {
                Some('\\') => {
                    self.position.increment_column();

                    match self.stream.next() {
                        Some(c) => {
                            if is_newline(c) {
                                return self.error(self.position, "RegExps may not contain newlines");

                            } else {
                                self.position.increment_column();
                                continue;
                            }
                        },
                        None => {
                            return self.error(char_start, "Missing escape sequence");
                        },
                    }
                },
                Some('/') => {
                    let raw_pattern = self.raw_str(pattern_start, self.position);

                    self.position.increment_column();

                    let flags_start = self.position;

                    self.consume_while0(|c| c.is_ascii_lowercase());

                    let raw_flags = self.raw_str(flags_start, self.position);

                    if self.is_number_or_identifier() {
                        return self.error(self.position, "RegExp cannot be followed by a number or identifier");
                    }

                    let end = self.position;

                    return Ok(Token::Literal(ast::Literal::RegExp(ast::RegExp {
                        raw_pattern,
                        raw_flags,
                        location: Location { start, end },
                    })));
                },
                Some(c) => {
                    if is_newline(c) {
                        return self.error(self.position, "RegExps may not contain newlines");

                    } else {
                        self.position.increment_column();
                        continue;
                    }
                },
                None => {
                    return self.error(start, "Missing ending /");
                },
            }
        }
    }


    fn parse_line_comment(&mut self) {
        self.consume_while0(|c| !is_newline(c));
    }

    fn parse_block_comment(&mut self, start: Position) -> Option<Result<Token<'a>, ParseError>> {
        let mut seen_newline = false;

        loop {
            match self.stream.next() {
                Some('*') => {
                    self.position.increment_column();

                    if self.consume_char('/') {
                        if seen_newline {
                            return Some(Ok(Token::Newline));

                        } else {
                            return None;
                        }
                    }
                },
                Some(c) => {
                    if self.process_newline(c) {
                        seen_newline = true;

                    } else {
                        self.position.increment_column();
                    }
                },
                None => {
                    return Some(self.error(start, "Missing */"));
                },
            }
        }
    }


    fn consume_hex_digit(&mut self) -> Result<(), ParseError> {
        if self.consume_if(|c| c.is_ascii_hexdigit()) {
            Ok(())

        } else {
            self.error_hex_digit()
        }
    }

    fn parse_unicode_code_point(&self, start: Position, end: Position) -> Result<char, ParseError> {
        match hex_to_char(self.raw_str(start, end)) {
            Some(c) => Ok(c),
            None => self.error(start, "Invalid Unicode code point"),
        }
    }

    // https://www.ecma-international.org/ecma-262/10.0/#prod-UnicodeEscapeSequence
    fn parse_unicode_escape_sequence(&mut self) -> Result<char, ParseError> {
        if self.consume_char('{') {
            let start = self.position;

            // TODO check the MV ?
            let matched = self.consume_while1(|c| c.is_ascii_hexdigit());

            if !matched {
                return self.error_hex_digit();
            }

            let end = self.position;

            if !self.consume_char('}') {
                self.error(self.position, "Expected }")?;
            }

            self.parse_unicode_code_point(start, end)

        } else {
            let start = self.position;

            self.consume_hex_digit()?;
            self.consume_hex_digit()?;
            self.consume_hex_digit()?;
            self.consume_hex_digit()?;

            let end = self.position;

            self.parse_unicode_code_point(start, end)
        }
    }

    fn parse_identifier_unicode<F>(&mut self, start: Position, f: F) -> Result<(), ParseError> where F: FnOnce(char) -> bool {
        if self.consume_char('u') {
            if f(self.parse_unicode_escape_sequence()?) {
                Ok(())

            } else {
                self.error(start, "Invalid Unicode code point for identifier")
            }

        } else {
            self.error(self.position, "Expected u")
        }
    }

    // https://www.ecma-international.org/ecma-262/10.0/#prod-IdentifierName
    fn parse_identifier(&mut self, start: Position, c: char) -> Result<Token<'a>, ParseError> {
        if is_identifier_start(c) {
            if c == '\\' {
                self.parse_identifier_unicode(start, is_identifier_start)?;
            }

            loop {
                let unicode_start = self.position;

                if self.consume_char('\\') {
                    self.parse_identifier_unicode(unicode_start, is_identifier_part)?;
                    continue;

                } else if self.consume_if(is_identifier_part) {
                    continue;

                } else {
                    break;
                }
            }

            let end = self.position;

            Ok(Token::Identifier(ast::Identifier {
                raw_value: self.raw_str(start, end),
                location: Location { start, end },
            }))

        } else {
            self.error(start, "Unexpected token")
        }
    }


    fn parse_decimal_digits0(&mut self) {
        self.consume_while0(|c| c.is_ascii_digit());
    }

    fn parse_decimal_digits1(&mut self) -> Result<(), ParseError> {
        if self.consume_while1(|c| c.is_ascii_digit()) {
            Ok(())

        } else {
            self.error(self.position, "Expected one of [0 1 2 3 4 5 6 7 8 9]")
        }
    }

    fn parse_decimal_number(&mut self) -> Result<(), ParseError> {
        if self.consume_char('.') {
            self.parse_decimal_digits0();
        }

        self.parse_exponent_part()?;

        Ok(())
    }

    fn parse_exponent_part(&mut self) -> Result<(), ParseError> {
        if self.consume_if(|c| c == 'e' || c == 'E') {
            self.consume_if(|c| c == '+' || c == '-');
            self.parse_decimal_digits1()?;
        }

        Ok(())
    }

    fn parse_after_number(&mut self) -> Result<(), ParseError> {
        if self.is_number_or_identifier() {
            return self.error(self.position, "Number cannot be followed by a number or identifier");
        }

        Ok(())
    }


    // TODO handle Unicode
    fn parse(&mut self, c: char, is_expression: bool, is_template: bool) -> Result<Token<'a>, ParseError> {
        if self.process_newline(c) {
            Ok(Token::Newline)

        } else {
            loop {
                let start = self.position;

                self.position.increment_column();

                return match c {
                    // https://www.ecma-international.org/ecma-262/10.0/#sec-white-space
                    '\u{0009}' |
                    '\u{000B}' |
                    '\u{000C}' |
                    '\u{0020}' |
                    '\u{00A0}' |
                    '\u{FEFF}' |
                    '\u{1680}' |
                    '\u{2000}'..='\u{200A}' |
                    '\u{202F}' |
                    '\u{205F}' |
                    '\u{3000}' => {
                        continue;
                    },

                    '/' => {
                        if self.consume_char('/') {
                            self.parse_line_comment();
                            continue;

                        } else if self.consume_char('*') {
                            if let Some(value) = self.parse_block_comment(start) {
                                return value;

                            } else {
                                continue;
                            }

                        } else if is_template {
                            return self.error(start, "Expected }");

                        } else if is_expression {
                            return self.parse_regexp(start);

                        } else {
                            self.consume_char('=');
                        }

                        self.punctuation(start)
                    },

                    _ if is_template => {
                        if c == '}' {
                            return self.parse_template(start, true);

                        } else {
                            return self.error(start, "Expected }");
                        }
                    },

                    // https://www.ecma-international.org/ecma-262/10.0/#prod-Punctuator
                    '{' |
                    '}' |
                    '(' |
                    ')' |
                    '[' |
                    ']' |
                    ';' |
                    ',' |
                    '~' |
                    '?' |
                    ':' => {
                        self.punctuation(start)
                    },

                    '.' => {
                        if self.consume_char('.') {
                            if !self.consume_char('.') {
                                return self.error(start, "Expected ...");
                            }

                        } else if self.consume_if(|c| c.is_ascii_digit()) {
                            self.parse_decimal_digits0();
                            self.parse_exponent_part()?;
                            self.parse_after_number()?;
                            return self.number(start);
                        }

                        self.punctuation(start)
                    },

                    // TODO use a single match for this
                    '<' => {
                        self.consume_char('<');
                        self.consume_char('=');
                        self.punctuation(start)
                    },

                    // TODO use a single match for this
                    '>' => {
                        if self.consume_char('>') {
                            self.consume_char('>');
                        }

                        self.consume_char('=');
                        self.punctuation(start)
                    },

                    '=' => {
                        if self.consume_char('=') {
                            self.consume_char('=');
                        } else {
                            self.consume_char('>');
                        }

                        self.punctuation(start)
                    },

                    '!' => {
                        if self.consume_char('=') {
                            self.consume_char('=');
                        }

                        self.punctuation(start)
                    },

                    '*' => {
                        self.consume_char('*');
                        self.consume_char('=');
                        self.punctuation(start)
                    },

                    '%' |
                    '^' => {
                        self.consume_char('=');
                        self.punctuation(start)
                    },

                    '+' |
                    '-' |
                    '&' |
                    '|' => {
                        if !self.consume_char(c) {
                            self.consume_char('=');
                        }

                        self.punctuation(start)
                    },

                    '"' => self.parse_string(start, '"'),
                    '\'' => self.parse_string(start, '\''),
                    '`' => self.parse_template(start, false),

                    '0' => {
                        if self.consume_if(|c| c == 'b' || c == 'B') {
                            let matches = self.consume_while1(|c| match c {
                                '0' | '1' => true,
                                _ => false,
                            });

                            if !matches {
                                self.error(self.position, "Expected 0 or 1")?;
                            }

                        } else if self.consume_if(|c| c == 'o' || c == 'O') {
                            let matches = self.consume_while1(|c| match c {
                                '0'..='7' => true,
                                _ => false,
                            });

                            if !matches {
                                self.error(self.position, "Expected one of [0 1 2 3 4 5 6 7]")?;
                            }

                        } else if self.consume_if(|c| c == 'x' || c == 'X') {
                            let matches = self.consume_while1(|c| c.is_ascii_hexdigit());

                            if !matches {
                                self.error_hex_digit()?;
                            }

                        } else {
                            self.parse_decimal_number()?;
                        }

                        self.parse_after_number()?;

                        self.number(start)
                    },
                    '1'..='9' => {
                        self.parse_decimal_digits0();
                        self.parse_decimal_number()?;
                        self.parse_after_number()?;
                        self.number(start)
                    },

                    c => self.parse_identifier(start, c),
                }
            }
        }
    }

    pub fn next(&mut self, is_expression: bool, is_template: bool) -> Option<Result<Token<'a>, ParseError>> {
        let c = self.stream.next()?;
        Some(self.parse(c, is_expression, is_template))
    }
}
