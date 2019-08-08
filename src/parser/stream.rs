#[derive(Debug, Clone)]
pub struct TextStream<'a> {
    iterator: std::str::Chars<'a>,
    pub offset: usize,
    pub line: usize,
    pub column: usize,
}

impl<'a> TextStream<'a> {
    #[inline]
    pub fn new(input: &'a str) -> {
        Self {
            iterator: input.chars(),
            offset: 0,
            line: 0,
            column: 0,
        }
    }

    #[inline]
    pub fn increment_column(&self) {
        self.column += 1;
    }

    #[inline]
    pub fn increment_line(&self) {
        self.column = 0;
        self.line += 1;
    }
}

impl<'a> Iterator for TextStream<'a> {
    type Item = char;

    #[inline]
    fn next(&mut self) -> Option<char> {
        self.offset += 1;
        self.iterator.next()
    }
}
