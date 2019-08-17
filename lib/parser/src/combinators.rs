#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Position {
    pub offset: usize,
    pub line: u32,
    pub column: u32,
}


pub type ParseResult<A, E> = Result<A, Option<E>>;


pub trait Parser {
    type Backtrack;
    type Error;
    type Slice;

    fn create_backtrack(&self) -> Self::Backtrack;

    fn restore_backtrack(&mut self, backtrack: Self::Backtrack);

    fn next(&mut self) -> Option<char>;

    fn position(&self) -> Position;

    fn slice(&self, start: usize, end: usize) -> Self::Slice;

    fn error(&self, start: Position, message: &str) -> Self::Error;
}


pub fn backtrack<P, A, E, F>(p: &mut P, f: F) -> ParseResult<A, E>
    where P: Parser,
          F: FnOnce(&mut P) -> ParseResult<A, E> {

    let point = p.create_backtrack();

    let value = f(p);

    if let Err(_) = value {
        p.restore_backtrack(point);
    }

    value
}


pub fn peek<P, A, E, F>(p: &mut P, f: F) -> ParseResult<Option<A>, E>
    where P: Parser,
          F: FnOnce(&mut P) -> ParseResult<A, E> {

    let point = p.create_backtrack();

    let value = f(p);

    p.restore_backtrack(point);

    match value {
        Ok(a) => Ok(Some(a)),
        Err(None) => Ok(None),
        Err(Some(e)) => Err(Some(e)),
    }
}


pub fn optional<P, A, E, F>(p: &mut P, f: F) -> ParseResult<Option<A>, E>
    where P: Parser,
          F: FnOnce(&mut P) -> ParseResult<A, E> {

    let point = p.create_backtrack();

    match f(p) {
        Ok(a) => Ok(Some(a)),
        Err(e) => {
            p.restore_backtrack(point);

            match e {
                None => Ok(None),
                Some(e) => Err(Some(e)),
            }
        },
    }
}


pub fn error<P, A, F>(p: &mut P, f: F, message: &str) -> ParseResult<A, P::Error>
    where P: Parser,
          F: FnOnce(&mut P) -> ParseResult<A, P::Error> {

    let start = p.position();

    on_fail(p,
        f,
        move |p| p.error(start, message),
    )
}


#[doc(hidden)]
#[macro_export]
macro_rules! __internal_alt {
    ($p:expr, $e:expr,) => {
        $crate::backtrack($p, $e)
    };
    ($p:expr, $e:expr, $($rest:expr,)*) => {
        match $crate::backtrack($p, $e) {
            Err(None) => $crate::__internal_alt!($p, $($rest,)*),
            v => v,
        }
    };
}

#[macro_export]
macro_rules! alt {
    ($p:expr, $($e:expr,)+) => {
        $crate::__internal_alt!($p, $($e,)+)
    };
}

#[macro_export]
macro_rules! alt_opt {
    ($p:expr, $($e:expr,)+) => {
        match $crate::alt!($p, $($e,)+) {
            Ok(v) => Ok(Some(v)),
            Err(None) => Ok(None),
            Err(Some(e)) => Err(Some(e)),
        }
    };
}


pub fn on_fail<P, A, E, F, O>(p: &mut P, f: F, on_fail: O) -> ParseResult<A, E>
    where F: FnOnce(&mut P) -> ParseResult<A, E>,
          O: FnOnce(&mut P) -> E {
    match f(p) {
        Err(None) => Err(Some(on_fail(p))),
        a => a,
    }
}


pub fn void<A, E, F>(f: F) -> ParseResult<(), E>
    where F: FnOnce() -> ParseResult<A, E> {
    let _ = f()?;
    Ok(())
}


pub fn char_if<P, E, F>(p: &mut P, f: F) -> ParseResult<char, E>
    where P: Parser,
          F: FnOnce(char) -> bool {
    match p.next() {
        Some(c) => {
            if f(c) {
                Ok(c)

            } else {
                Err(None)
            }
        },
        None => Err(None),
    }
}

pub fn char<P, E>(p: &mut P, pat: char) -> ParseResult<(), E> where P: Parser {
    void(|| char_if(p, move |c| c == pat))
}

pub fn one_of<P, E>(p: &mut P, pat: &str) -> ParseResult<(), E> where P: Parser {
    void(|| char_if(p, move |c| {
        for pat in pat.chars() {
            if pat == c {
                return true;
            }
        }

        false
    }))
}

pub fn any_char<P, E>(p: &mut P) -> ParseResult<(), E> where P: Parser {
    void(|| char_if(p, |_| true))
}

// TODO make this faster ?
pub fn eq<P, E>(p: &mut P, pat: &str) -> ParseResult<(), E> where P: Parser {
    let mut chars = pat.chars();

    loop {
        match chars.next() {
            Some(pat) => {
                char(p, pat)?;
            },
            None => {
                return Ok(());
            },
        }
    }
}

pub fn many0<A, E, F>(mut f: F) -> ParseResult<Vec<A>, E>
    where F: FnMut() -> ParseResult<Option<A>, E> {

    let mut output = vec![];

    loop {
        return match f()? {
            Some(value) => {
                output.push(value);
                continue;
            },
            None => {
                Ok(output)
            },
        }
    }
}

pub fn many1<A, E, F>(mut f: F) -> ParseResult<Vec<A>, E>
    where F: FnMut() -> ParseResult<Option<A>, E> {

    let mut output = vec![];

    loop {
        return match f()? {
            Some(value) => {
                output.push(value);
                continue;
            },
            None => {
                if output.is_empty() {
                    Err(None)

                } else {
                    Ok(output)
                }
            },
        }
    }
}

pub fn each0<E, F>(mut f: F) -> ParseResult<(), E>
    where F: FnMut() -> ParseResult<Option<()>, E> {

    loop {
        return match f()? {
            Some(_) => continue,
            None => Ok(()),
        }
    }
}

pub fn each1<E, F>(mut f: F) -> ParseResult<(), E>
    where F: FnMut() -> ParseResult<Option<()>, E> {

    let mut matched = false;

    loop {
        return match f()? {
            Some(_) => {
                matched = true;
                continue;
            },
            None => {
                if matched {
                    Ok(())

                } else {
                    Err(None)
                }
            },
        }
    }
}


// TODO is this correct ?
pub fn eof<P, E>(p: &mut P) -> ParseResult<(), E> where P: Parser {
    if let Some(_) = p.next() {
        Err(None)

    } else {
        Ok(())
    }
}
