impl<'a, 'b> TokenStream<'a, 'b> {
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
}
