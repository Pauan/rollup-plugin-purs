#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Position {
    pub offset: usize,
    pub line: usize,
    pub column: usize,
}

impl Position {
    #[inline]
    pub fn increment_column(&mut self) {
        self.column += 1;
    }

    #[inline]
    pub fn increment_line(&mut self) {
        self.column = 0;
        self.line += 1;
    }
}


#[derive(Debug, Clone, PartialEq)]
pub struct Span<A> {
    pub value: A,
    pub start: Position,
    pub end: Position,
}

impl<A> std::ops::Deref for Span<A> {
    type Target = A;

    fn deref(&self) -> &Self::Target {
        &self.value
    }
}


#[derive(Debug, Clone, PartialEq)]
pub struct Identifier<'a> {
    pub name: &'a str,
}

impl<'a> Identifier<'a> {
    pub fn is_reserved_word(&self) -> bool {
        match self.name {
            // Keywords
            "await" | "break" | "case" | "catch" | "class" | "const" | "continue" | "debugger" | "default" | "delete" | "do" |
            "else" | "export" | "extends" | "finally" | "for" | "function" | "if" | "import" | "in" | "instanceof" | "new" |
            "return" | "super" | "switch" | "this" | "throw" | "try" | "typeof" | "var" | "void" | "while" | "with" | "yield" => true,
            // Static early errors
            "let" | "static" => true,
            // Future reserved words
            "enum" | "implements" | "package" | "protected" | "interface" | "private" | "public" => true,
            // Literals
            "null" | "true" | "false" => true,
            _ => false,
        }
    }
}


#[derive(Debug, Clone, PartialEq)]
pub struct StringLiteral<'a> {
    pub raw_value: &'a str,
}

#[derive(Debug, Clone, PartialEq)]
pub enum Literal<'a> {
    String(StringLiteral<'a>),
    Boolean(bool),
    Null,
    Number(f64),
    RegExp {
        pattern: &'a str,
        flags: &'a str,
    },
}

#[derive(Debug, Clone, PartialEq)]
pub struct SwitchCase<'a> {
    pub test: Option<Span<Expression<'a>>>,
    pub yes: Vec<Span<Statement<'a>>>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct TryCatch<'a> {
    pub param: Option<Span<Pattern<'a>>>,
    pub body: Vec<Span<Statement<'a>>>,
}

#[derive(Debug, Clone, PartialEq)]
pub enum ForInitialize<'a> {
    VariableDeclaration(VariableDeclaration<'a>),
    Expression(Expression<'a>),
}

#[derive(Debug, Clone, PartialEq)]
pub enum ForInPattern<'a> {
    VariableDeclaration(VariableDeclaration<'a>),
    Pattern(Pattern<'a>),
}

#[derive(Debug, Clone, PartialEq)]
pub enum VariableKind {
    Var,
    Let,
    Const,
}

#[derive(Debug, Clone, PartialEq)]
pub struct VariableAssignment<'a> {
    pub pattern: Span<Pattern<'a>>,
    pub initial: Option<Expression<'a>>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct VariableDeclaration<'a> {
    pub kind: VariableKind,
    pub assignments: Vec<Span<VariableAssignment<'a>>>,
}

#[derive(Debug, Clone, PartialEq)]
pub enum Restable<'a, A> {
    Normal(A),
    Rest {
        argument: Span<Box<Pattern<'a>>>,
    },
}

#[derive(Debug, Clone, PartialEq)]
pub struct PatternObjectProperty<'a> {
    pub key: Span<ObjectPropertyKey<'a>>,
    pub value: Span<Pattern<'a>>,
    pub is_shorthand: bool,
}

#[derive(Debug, Clone, PartialEq)]
pub enum Pattern<'a> {
    Identifier(Identifier<'a>),
    Object {
        properties: Vec<Span<Restable<'a, PatternObjectProperty<'a>>>>,
    },
    Array {
        elements: Vec<Option<Span<Pattern<'a>>>>,
    },
    Rest(Span<Restable<'a, Box<Pattern<'a>>>>),
    Default {
        left: Span<Box<Pattern<'a>>>,
        // TODO get rid of this Box somehow
        right: Span<Box<Expression<'a>>>,
    },
}

#[derive(Debug, Clone, PartialEq)]
pub enum PropertyKind {
    Init,
    Get,
    Set,
}

#[derive(Debug, Clone, PartialEq)]
pub enum ObjectPropertyKey<'a> {
    Identifier(Identifier<'a>),
    Expression(Expression<'a>),
}

#[derive(Debug, Clone, PartialEq)]
pub struct FunctionMetadata {
    pub is_generator: bool,
    pub is_async: bool,
}

#[derive(Debug, Clone, PartialEq)]
pub struct ObjectProperty<'a> {
    pub kind: PropertyKind,
    pub key: Span<ObjectPropertyKey<'a>>,
    pub value: Span<Expression<'a>>,
    pub is_method: bool,
    pub is_shorthand: bool,
}

#[derive(Debug, Clone, PartialEq)]
pub enum MethodDefinitionKind {
    Constructor,
    Method,
    Get,
    Set,
}

#[derive(Debug, Clone, PartialEq)]
pub struct MethodDefinition<'a> {
    pub kind: MethodDefinitionKind,
    pub key: Span<ObjectPropertyKey<'a>>,
    pub params: Vec<Span<Pattern<'a>>>,
    pub body: Vec<Span<Statement<'a>>>,
    pub metadata: FunctionMetadata,
    pub is_static: bool,
}

#[derive(Debug, Clone, PartialEq)]
pub enum UnaryKind {
    Minus,
    Plus,
    Not,
    BitNot,
    Typeof,
    Void,
    Delete,
    PrefixIncrement,
    PostfixIncrement,
    PrefixDecrement,
    PostfixDecrement,
}

#[derive(Debug, Clone, PartialEq)]
pub enum BinaryKind {
    DoubleEqual,
    DoubleNotEqual,
    TripleEqual,
    TripleNotEqual,
    Less,
    LessEqual,
    Greater,
    GreaterEqual,
    LeftShift,
    RightShift,
    UnsignedRightShift,
    Plus,
    Minus,
    Multiply,
    Divide,
    Modulo,
    Exponent,
    BitOr,
    BitXor,
    BitAnd,
    In,
    Instanceof,
    Or,
    And,
}

#[derive(Debug, Clone, PartialEq)]
pub enum AssignKind {
    Normal,
    Plus,
    Minus,
    Multiply,
    Divide,
    Modulo,
    Exponent,
    LeftShift,
    RightShift,
    UnsignedRightShift,
    BitOr,
    BitXor,
    BitAnd,
}

#[derive(Debug, Clone, PartialEq)]
pub enum LookupProperty<'a> {
    Identifier(Identifier<'a>),
    Expression(Box<Expression<'a>>),
}

#[derive(Debug, Clone, PartialEq)]
pub enum Spreadable<'a, A> {
    Normal(A),
    Spread {
        argument: Span<Expression<'a>>,
    },
}

#[derive(Debug, Clone, PartialEq)]
pub enum ArrowFunctionBody<'a> {
    Expression(Span<Box<Expression<'a>>>),
    Statements(Vec<Span<Statement<'a>>>),
}

#[derive(Debug, Clone, PartialEq)]
pub struct TemplateElement<'a> {
    pub tail: bool,
    pub cooked: Option<&'a str>,
    pub raw: &'a str,
}

// TODO MetaProperty
#[derive(Debug, Clone, PartialEq)]
pub enum Expression<'a> {
    This,
    Super,
    Array {
        elements: Vec<Option<Span<Spreadable<'a, Expression<'a>>>>>,
    },
    Object {
        properties: Vec<Span<Spreadable<'a, ObjectProperty<'a>>>>,
    },
    Function {
        name: Option<Span<Identifier<'a>>>,
        params: Vec<Span<Pattern<'a>>>,
        body: Vec<Span<Statement<'a>>>,
        metadata: FunctionMetadata,
    },
    // TODO is it possible for these to be generators ?
    ArrowFunction {
        params: Vec<Span<Pattern<'a>>>,
        body: ArrowFunctionBody<'a>,
        metadata: FunctionMetadata,
    },
    Unary {
        kind: UnaryKind,
        argument: Span<Box<Expression<'a>>>,
    },
    Binary {
        kind: BinaryKind,
        left: Span<Box<Expression<'a>>>,
        right: Span<Box<Expression<'a>>>,
    },
    Assign {
        kind: AssignKind,
        left: Span<Pattern<'a>>,
        right: Span<Box<Expression<'a>>>,
    },
    Lookup {
        object: Span<Box<Expression<'a>>>,
        property: Span<LookupProperty<'a>>,
    },
    If {
        test: Span<Box<Expression<'a>>>,
        yes: Span<Box<Expression<'a>>>,
        no: Span<Box<Expression<'a>>>,
    },
    Call {
        function: Span<Box<Expression<'a>>>,
        arguments: Vec<Span<Spreadable<'a, Expression<'a>>>>,
    },
    New {
        function: Span<Box<Expression<'a>>>,
        arguments: Vec<Span<Spreadable<'a, Expression<'a>>>>,
    },
    Comma {
        expressions: Vec<Span<Expression<'a>>>,
    },
    Yield {
        argument: Option<Span<Box<Expression<'a>>>>,
    },
    YieldAll {
        argument: Option<Span<Box<Expression<'a>>>>,
    },
    Await {
        argument: Span<Box<Expression<'a>>>,
    },
    Template {
        tag: Option<Span<Box<Expression<'a>>>>,
        quasis: Vec<Span<TemplateElement<'a>>>,
        expressions: Vec<Span<Expression<'a>>>,
    },
    Class {
        name: Option<Span<Identifier<'a>>>,
        parent: Option<Span<Box<Expression<'a>>>>,
        body: Vec<Span<MethodDefinition<'a>>>,
    },
}

#[derive(Debug, Clone, PartialEq)]
pub enum Declaration<'a> {
    VariableDeclaration(VariableDeclaration<'a>),
    FunctionDeclaration {
        name: Span<Identifier<'a>>,
        params: Vec<Span<Pattern<'a>>>,
        body: Vec<Span<Statement<'a>>>,
        metadata: FunctionMetadata,
    },
    ClassDeclaration {
        name: Span<Identifier<'a>>,
        parent: Option<Span<Expression<'a>>>,
        body: Vec<Span<MethodDefinition<'a>>>,
    },
}

#[derive(Debug, Clone, PartialEq)]
pub enum Statement<'a> {
    Expression {
        expression: Span<Expression<'a>>,
    },
    Block {
        body: Vec<Span<Statement<'a>>>,
    },
    Empty,
    Debugger,
    With {
        object: Span<Expression<'a>>,
        body: Span<Box<Statement<'a>>>,
    },
    Return {
        argument: Option<Span<Expression<'a>>>,
    },
    Label {
        label: Span<Identifier<'a>>,
        body: Span<Box<Statement<'a>>>,
    },
    Break {
        label: Option<Span<Identifier<'a>>>,
    },
    Continue {
        label: Option<Span<Identifier<'a>>>,
    },
    If {
        test: Span<Expression<'a>>,
        yes: Span<Box<Statement<'a>>>,
        no: Option<Span<Box<Statement<'a>>>>,
    },
    Switch {
        test: Span<Expression<'a>>,
        cases: Vec<Span<SwitchCase<'a>>>,
    },
    Throw {
        argument: Span<Expression<'a>>,
    },
    Try {
        body: Vec<Span<Statement<'a>>>,
        catch: Option<Span<TryCatch<'a>>>,
        finally: Option<Vec<Span<Statement<'a>>>>,
    },
    While {
        test: Span<Expression<'a>>,
        body: Span<Box<Statement<'a>>>,
    },
    DoWhile {
        body: Span<Box<Statement<'a>>>,
        test: Span<Expression<'a>>,
    },
    For {
        init: Option<Span<ForInitialize<'a>>>,
        test: Option<Span<Expression<'a>>>,
        update: Option<Span<Expression<'a>>>,
        body: Span<Box<Statement<'a>>>,
    },
    ForIn {
        left: Span<ForInPattern<'a>>,
        right: Span<Expression<'a>>,
        body: Span<Box<Statement<'a>>>,
    },
    ForOf {
        left: Span<ForInPattern<'a>>,
        right: Span<Expression<'a>>,
        body: Span<Box<Statement<'a>>>,
        is_await: bool,
    },
    Declaration(Declaration<'a>),
}

#[derive(Debug, Clone, PartialEq)]
pub enum ImportSpecifier<'a> {
    Single {
        local: Span<Identifier<'a>>,
        external: Span<Identifier<'a>>,
    },
    Default {
        local: Span<Identifier<'a>>,
    },
    Namespace {
        local: Span<Identifier<'a>>,
    },
}

#[derive(Debug, Clone, PartialEq)]
pub struct ExportSpecifier<'a> {
    pub local: Span<Identifier<'a>>,
    pub external: Span<Identifier<'a>>,
}

#[derive(Debug, Clone, PartialEq)]
pub enum ModuleStatement<'a> {
    Statement(Statement<'a>),
    Import {
        specifiers: Vec<Span<ImportSpecifier<'a>>>,
        filename: Span<StringLiteral<'a>>,
    },
    ExportDeclaration(Span<Declaration<'a>>),
    ExportModule {
        specifiers: Vec<Span<ExportSpecifier<'a>>>,
        filename: Option<Span<StringLiteral<'a>>>,
    },
    ExportDefault {
        expression: Span<Expression<'a>>,
    },
    ExportAll {
        filename: Span<StringLiteral<'a>>,
    },
}

#[derive(Debug, Clone, PartialEq)]
pub struct Module<'a> {
    pub statements: Vec<Span<ModuleStatement<'a>>>,
}
