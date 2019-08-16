pub trait Parser {
    type Backtrack;

    fn create_backtrack(&self) -> Self::Backtrack;
    fn restore_backtrack(&mut self, backtrack: Self::Backtrack);

    fn next(&mut self) -> Option<char>;
}


pub type ParseResult<A, E> = Result<A, Option<E>>;


pub fn backtrack<P, A, E, F>(f: F) -> impl FnOnce(&mut P) -> ParseResult<A, E>
    where P: Parser,
          F: FnOnce(&mut P) -> ParseResult<A, E> {
    move |p| {
        let point = p.create_backtrack();

        match f(p) {
            Ok(s) => Ok(s),
            Err(e) => {
                p.restore_backtrack(point);
                Err(e)
            },
        }
    }
}


#[doc(hidden)]
#[macro_export]
macro_rules! __internal_alt {
    ($this:expr, $e:expr,) => {
        $e($this)
    };
    ($this:expr, $e:expr, $($rest:expr,)*) => {
        match $e($this) {
            Err(None) => $crate::__internal_alt!($this, $($rest,)*),
            v => v,
        }
    };
}

#[macro_export]
macro_rules! alt {
    ($($e:expr,)+) => {
        move |p| $crate::__internal_alt!(p, $($crate::backtrack($e),)+)
    };
}

#[macro_export]
macro_rules! alt_opt {
    ($($e:expr,)+) => {
        $crate::alt!(
            $(move |i| Ok(Some($e(i)?)),)+
            |_| Ok(None),
        )
    };
}


pub fn on_fail<P, A, E, F, O>(f: F, on_fail: O) -> impl FnMut(&mut P) -> ParseResult<A, E>
    where P: Parser,
          F: FnMut(&mut P) -> ParseResult<A, E>,
          O: FnMut(&mut P) -> E {
    move |p| {
        match f(p) {
            Err(None) => Err(Some(on_fail(p))),
            a => a,
        }
    }
}


pub fn void<P, A, E, F>(f: F) -> impl FnMut(&mut P) -> ParseResult<(), E>
    where P: Parser,
          F: FnMut(&mut P) -> ParseResult<A, E> {
    move |p| {
        let _ = f(p)?;
        Ok(())
    }
}


pub fn is<P, E, F>(f: F) -> impl FnMut(&mut P) -> ParseResult<char, E>
    where P: Parser,
          F: FnMut(char) -> bool {
    move |p| {
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
}

pub fn char<P, E>(pat: char) -> impl FnMut(&mut P) -> ParseResult<(), E> where P: Parser {
    void(is(move |c| c == pat))
}

pub fn one_of<'a, P, E>(pat: &'a str) -> impl FnMut(&mut P) -> ParseResult<(), E> + 'a
    where P: Parser + 'a,
          E: 'a {
    void(is(move |c| {
        for pat in pat.chars() {
            if pat == c {
                return true;
            }
        }

        false
    }))
}

// TODO make this faster ?
pub fn eq<P, E>(pat: &str) -> impl FnMut(&mut P) -> ParseResult<(), E> + '_
    where P: Parser {
    move |p| {
        let chars = pat.chars();

        loop {
            match chars.next() {
                Some(pat) => {
                    char(pat)(p)?;
                },
                None => {
                    return Ok(());
                },
            }
        }
    }
}

pub fn many0<P, A, E, F>(mut f: F) -> impl FnMut(&mut P) -> ParseResult<Vec<A>, E>
    where P: Parser,
          F: FnMut(&mut P) -> ParseResult<Option<A>, E> {
    move |p| {
        let mut output = vec![];

        loop {
            return match f(p)? {
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
}

pub fn each0<P, E, F>(mut f: F) -> impl FnMut(&mut P) -> ParseResult<(), E>
    where P: Parser,
          F: FnMut(&mut P) -> ParseResult<Option<()>, E> {
    move |p| {
        loop {
            return match f(p)? {
                Some(_) => continue,
                None => Ok(()),
            }
        }
    }
}

pub fn each1<P, E, F>(mut f: F) -> impl FnMut(&mut P) -> ParseResult<(), E>
    where P: Parser,
          F: FnMut(&mut P) -> ParseResult<Option<()>, E> {
    move |p| {
        let mut matched = false;

        loop {
            return match f(p)? {
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
}
