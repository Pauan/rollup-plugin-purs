module Main where

import Pauan.Prelude
import Pauan.Mutable as Mutable
import Pauan.MutableArray as MutableArray
import Pauan.Panel.Types (Tab, Group, makeState)
import Pauan.Panel.View.Tab (draggingTrait, draggingView, tabView)
import Pauan.HTML (render)
import Pauan.Panel.View.Group (groupView)
import Pauan.Animation as Animation
import Pauan.StreamArray (mapWithIndex)


makeTab :: forall eff. Mutable.Mutable Int -> String -> Transaction (mutable :: Mutable.MUTABLE | eff) Tab
makeTab id title = do
  id >> Mutable.modify (_ + 1)
  id' <- id >> Mutable.get

  top <- Mutable.make Nothing
  matchedSearch <- Mutable.make true
  dragging <- Mutable.make false
  selected <- Mutable.make false
  unloaded <- Mutable.make false

  pure { id: show id', title, url: "", matchedSearch, dragging, top, selected, unloaded }


makeGroup :: forall eff. Mutable.Mutable Int -> Array String -> Transaction (mutable :: Mutable.MUTABLE | eff) Group
makeGroup id a = do
  a' <- a >> map (makeTab id) >> sequence
  tabs <- MutableArray.make a'
  height <- Mutable.make Nothing
  pure { tabs, height }


root :: forall eff. Eff (mutable :: Mutable.MUTABLE | eff) HTML
root = runTransaction do
  state <- makeState

  id <- Mutable.make 0

  group <- makeGroup id (((0..20) >> map \i -> "Testing testing "  ++ show i) ++
   [ "Fable"
   , "Null-checking considerations in F#"
   , "options.html" ])

  state.groups >> MutableArray.push group

  --setTimeout 1000 << runTransaction do
    --a >> Mutable.set [4, 5, 6]
  pure << html "div"
    [ draggingTrait state
    , style "font-family" "sans-serif"
    , style "font-size" "13px"
    {-, style "padding" mutable.map(opt("groups.layout"), (x) => {
      switch (x) {
      case "horizontal":
      case "grid":
        return "5px 0px 0px 0px";
      default:
        return "2px 0px 0px 0px";
      }
    }),

    "background-color": mutable.map(opt("groups.layout"), (x) => {
      switch (x) {
      case "horizontal":
      case "grid":
        return dom.hsl(0, 0, 98);
      default:
        return dom.hsl(0, 0, 100);
      }
    }),-}

    , style "width" "100%"
    , style "height" "100%"
    , style "white-space" "pre"
    -- TODO this is a bit hacky, use an event instead ?
    , style "user-select" "none"
    , style "overflow-x" "hidden" ]
    [ draggingView state
    , html "button"
        [ on "click" \_ -> runTransaction do
            tab <- makeTab id "Testing testing"
            group.tabs >> MutableArray.deleteAt 0
            group.tabs >> MutableArray.push tab ]
        [ text "Activate" ]
    , html "button"
        [ on "click" \_ -> runTransaction do
            tabs <- group.tabs >> MutableArray.get
            for_ tabs \tab -> do
              group.tabs >> MutableArray.deleteAt 0
            state.groups >> MutableArray.deleteAt 0 ]
        [ text "Delete" ]
    , html "div"
        []
        (state.groups >> streamArray >> mapWithIndex (groupView state) >> Animation.animatedMap
          (\animation f -> f (animation >> map (Animation.easeInOut (Animation.easePow 2.0))))
          { replace: [ Animation.Jump { to: 1.0 } ]
          , insert: [ Animation.Tween { to: 1.0, duration: 500.0 } ]
          , update: []
          , remove: [ Animation.Tween { to: 0.0, duration: 500.0 } ] }) ]


main :: forall eff. Eff (mutable :: Mutable.MUTABLE | eff) Unit
main = do
  --_ <- [1, 2, 3] >> stream >> each (spy >>> pure >>> void) (spy >>> pure) (pure unit)
  a <- root
  a >> render >> void

{-main :: Eff (err :: EXCEPTION) Unit
main = void << launchAff do
  liftEff do-}
    {-a <- Mutable.make 1
    b <- Mutable.make 2
    c <- Mutable.make 3
    observe
      (\a -> show a >> log)
      --(map (\a b c -> a + b + c) << view a |< view b |< view c)
      (view a >|
       view b >|
       view c >>
       map \a b c ->
         a + b + c)
      >> void
    runTransaction do
      a >> Mutable.set 20
    runTransaction do
      b >> Mutable.set 30
    runTransaction do
      c >> Mutable.set 40
    runTransaction do
      a >> Mutable.set 1
      b >> Mutable.set 2
      c >> Mutable.set 3-}
