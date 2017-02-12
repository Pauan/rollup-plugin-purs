module Pauan.HTML
  ( module Exports
  , on
  , onLeftClick
  , onMiddleClick
  , onRightClick
  , ClickEvent
  , onHoverSet
  , widget
  , html
  , text
  , style
  , styleImportant
  , body
  , trait
  , property
  , checked
  , sampleOn
  , render
  , hsl
  , hsla
  , DragEvent
  , DOMPosition
  , onDrag
  , topZIndex
  , floating
  , hidden
  ) where

import Prelude
import Control.Monad.Eff (Eff)
import Pauan.View (View, currentValue)
import Pauan.Resource (Resource)
import Pauan.Transaction (runTransaction)
import Pauan.Mutable as Mutable
import Data.Function.Uncurried (Fn2, Fn3, Fn4, Fn5, runFn2)

import Pauan.HTML.Unsafe
  ( Event
  , State
  , Trait
  , HTML
  , DOMElement
  , render'
  , class HTMLProperty
  , class HTMLStyle
  , class HTMLText
  , class HTMLChild
  , unsafeAppendChild
  , unsafeMakeText
  , unsafeSetStyle
  , unsafeProperty
  )

import Pauan.HTML.Unsafe
  ( DOMElement
  , HTML
  , Event
  , State
  , Trait
  , class HTMLProperty
  , class HTMLStyle
  , class HTMLChild
  , class HTMLText
  , beforeRemove
  , afterInsert
  , render'
  ) as Exports


foreign import onImpl :: forall eff.
  String ->
  (Event -> Eff eff Unit) ->
  Trait

on :: forall eff. String -> (Event -> Eff eff Unit) -> Trait
on = onImpl


type ClickEvent =
  { shift :: Boolean
  , ctrl :: Boolean
  , alt :: Boolean }

foreign import onClickImpl :: forall eff.
  Fn2
  (Boolean -> Boolean -> Boolean -> ClickEvent)
  Int
  ((ClickEvent -> Eff eff Unit) ->
   Trait)

onLeftClick :: forall eff. (ClickEvent -> Eff eff Unit) -> Trait
onLeftClick = runFn2 onClickImpl { shift: _, ctrl: _, alt: _ } 0

onMiddleClick :: forall eff. (ClickEvent -> Eff eff Unit) -> Trait
onMiddleClick = runFn2 onClickImpl { shift: _, ctrl: _, alt: _ } 1

onRightClick :: forall eff. (ClickEvent -> Eff eff Unit) -> Trait
onRightClick = runFn2 onClickImpl { shift: _, ctrl: _, alt: _ } 2


foreign import widget :: forall eff. (State -> Eff eff HTML) -> HTML


foreign import htmlImpl :: forall a.
  (Fn3 State DOMElement a Unit) ->
  String ->
  Array Trait ->
  a ->
  HTML

html :: forall a. (HTMLChild a) => String -> Array Trait -> a -> HTML
html = htmlImpl unsafeAppendChild


foreign import textImpl :: forall a.
  (Fn2 State a DOMElement) ->
  a ->
  HTML

text :: forall a. (HTMLText a) => a -> HTML
text = textImpl unsafeMakeText


foreign import styleImpl :: forall a.
  (Fn5 State DOMElement String a String Unit) ->
  String ->
  String ->
  a ->
  Trait

style :: forall a. (HTMLStyle a) => String -> a -> Trait
style = styleImpl unsafeSetStyle ""


styleImportant :: forall a. (HTMLStyle a) => String -> a -> Trait
styleImportant = styleImpl unsafeSetStyle "important"


-- TODO should this return Eff ?
foreign import body :: forall eff. Eff eff DOMElement


property :: forall a. (HTMLProperty a String) => String -> a -> Trait
property = unsafeProperty

-- TODO what about indeterminacy ?
checked :: forall a. (HTMLProperty a Boolean) => a -> Trait
checked = unsafeProperty "checked"

hidden :: forall a. (HTMLProperty a Boolean) => a -> Trait
hidden = unsafeProperty "hidden"


foreign import trait :: Array Trait -> Trait


-- TODO maybe remove this ?
sampleOn :: forall eff a. String -> View a -> (Event -> a -> Eff eff Unit) -> Trait
sampleOn name view f =
  on name \e -> do
    -- TODO make this more efficient ?
    v <- runTransaction (currentValue view)
    f e v


render :: forall eff. HTML -> Eff eff Resource
render a = do
  b <- body
  render' b a


hsl :: Int -> Int -> Int -> String
-- TODO should this use show ?
hsl h s l = "hsl(" <> show h <> ", " <> show s <> "%, " <> show l <> "%)"


hsla :: Int -> Int -> Int -> Number -> String
-- TODO should this use show ?
hsla h s l a = "hsla(" <> show h <> ", " <> show s <> "%, " <> show l <> "%, " <> show a <> ")"


onHoverSet :: Mutable.Mutable Boolean -> Trait
onHoverSet mut =
  trait [ on "mouseenter" \_ -> runTransaction do
            Mutable.set true mut
        , on "mouseleave" \_ -> runTransaction do
            Mutable.set false mut ]


-- TODO replace with purescript-dom
-- TODO use Number ?
type DOMPosition =
  { left :: Int
  , top :: Int
  , width :: Int
  , height :: Int }


type DragEvent =
  { startX :: Int
  , startY :: Int
  , currentX :: Int
  , currentY :: Int
  , position :: DOMPosition }

type DragHandler eff = DragEvent -> Eff eff Unit


foreign import onDragImpl :: forall eff.
  (Int -> Int -> Int -> Int -> DOMPosition -> DragEvent) ->
  (Int -> Int -> Int -> Int -> DOMPosition) ->
  (DragEvent -> Eff eff Boolean) ->
  DragHandler eff ->
  DragHandler eff ->
  DragHandler eff ->
  Trait

onDrag' :: forall eff.
  (DragEvent -> Eff eff Boolean) ->
  DragHandler eff ->
  DragHandler eff ->
  DragHandler eff ->
  Trait
-- TODO make this more efficient
onDrag' = onDragImpl
  { startX: _, startY: _, currentX: _, currentY: _, position: _ }
  { left: _, top: _, width: _, height: _ }

onDrag :: forall eff.
  { threshold :: DragEvent -> Eff eff Boolean
  , start :: DragHandler eff
  , move :: DragHandler eff
  , end :: DragHandler eff } ->
  Trait
onDrag x = onDrag' x.threshold x.start x.move x.end


-- 32-bit signed int
topZIndex :: String
topZIndex = "2147483647"


floating :: Trait
floating = trait
  [ style "position" "fixed"
  , style "z-index" topZIndex ]
