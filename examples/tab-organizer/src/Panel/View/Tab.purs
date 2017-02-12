module Pauan.Panel.View.Tab where

import Pauan.Prelude
import Pauan.Mutable as Mutable
import Pauan.Animation as Animation
import Pauan.Panel.Types (State, Group, Tab, Dragging, notDragging, updateDragging, stopDragging, isVisible)
import Pauan.HTML (widget)
import Pauan.MutableArray as MutableArray
import Data.Array (mapWithIndex)


tabHeight :: Int
tabHeight = 20


row :: Trait
row = trait
  [ style "display" "flex"
  , style "flex-direction" "row"
  -- TODO get rid of this ?
  , style "align-items" "center" ]


-- TODO move this someplace else
stretch :: Trait
stretch = trait
  -- Needed to avoid min size constraints
  -- http://stackoverflow.com/a/36247448/449477
  [ style "min-width" "0"
  , style "min-height" "0"
  , style "flex" "1 1 0" ]


menuItemTrait :: State -> View Boolean -> View Boolean -> Trait
menuItemTrait state isHovering isSelected = trait
  [ style "cursor" (state >> notDragging >> mapIf "pointer" "")
  , style "border-width" "1px"

  , style "transition-timing-function" "ease-in-out, ease-out"
  , style "transition-property" "background-color, transform"
  , style "transition-duration"
      (map2 isHovering (view state.draggingAnimate) \isHovering' draggingAnimate ->
        (if isHovering' then "0ms" else "100ms") ++ ", " ++
        (if draggingAnimate then "100ms" else "0ms"))
  {- "transition": mutable.latest([
    opt("theme.animation"),
    dragging_animate
  ], (animation, dragging_animate) =>
    (animation
      ? (dragging_animate
          // TODO minor code duplication
          ? "background-color 100ms ease-in-out, transform 100ms ease-out"
          : "background-color 100ms ease-in-out")
      : null)), -}

  , style "background-image"
      (isHovering >> mapIfTrue
        ("linear-gradient(to bottom, " ++
           hsla 0 0 100 0.2 ++ " 0%, " ++
           "transparent"    ++ " 49%, " ++
           hsla 0 0   0 0.1 ++ " 50%, " ++
           hsla 0 0 100 0.1 ++ " 80%, " ++
           hsla 0 0 100 0.2 ++ " 100%)," ++
         repeatingGradient))

  , style "color"
      (isHovering >> mapIfTrue (hsla 211 100 99 0.95))

  , style "background-color"
      (map2 isHovering isSelected \isHovering' isSelected' ->
        if isHovering' && isSelected'
        then hsl 100 80 45
        else if isSelected'
        then hsl 100 78 80
        else if isHovering'
        then hsl 211 100 65
        else "")

  , style "border-color"
      (map2 isHovering isSelected \isHovering' isSelected' ->
        if isSelected'
        then hsl 100 50 55 ++ " " ++
             hsl 100 50 50 ++ " " ++
             hsl 100 50 45 ++ " " ++
             hsl 100 50 50
        else if isHovering'
        then hsl 211 38 62 ++ " " ++
             hsl 211 38 57 ++ " " ++
             hsl 211 38 52 ++ " " ++
             hsl 211 38 57
        else "transparent")

  , style "text-shadow"
      (isHovering >> mapIfTrue
        ("1px 0px 1px " ++ hsla 0 0 0 0.2 ++ "," ++
         "0px 0px 1px " ++ hsla 0 0 0 0.1 ++ "," ++
         -- TODO why is it duplicated like this ?
         "0px 1px 1px " ++ hsla 0 0 0 0.2))

  , style "box-shadow"
      (map2 isHovering isSelected \isHovering' isSelected' ->
        if isHovering' || isSelected'
        then       "1px 1px  1px " ++ hsla 0 0   0 0.25 ++ "," ++
             "inset 0px 0px  3px " ++ hsla 0 0 100 1.0  ++ "," ++
             "inset 0px 0px 10px " ++ hsla 0 0 100 0.25
        else "") ]


repeatingGradient :: String
repeatingGradient =
  "repeating-linear-gradient(-45deg, " ++
    "transparent"     ++ " 0px, " ++
    "transparent"     ++ " 4px, " ++
    hsla 0 0 100 0.05 ++ " 6px, " ++
    hsla 0 0 100 0.05 ++ " 10px)"


draggingView :: State -> HTML
draggingView state =
  html "div"
    [ floating
    , style "pointer-events" "none"
    , style "opacity" "0.98"
    , style "overflow" "visible"
    , style "width" (view dragging >> map width')
    , style "transform" (map2 (dragging >> view) (draggingPosition >> view) transform)
    , hidden (state >> notDragging) ]
    -- TODO make this more efficient ?
    (view dragging >> map selected' >> streamArray >> Animation.animatedMap
      (\animation f -> f (animation >> map (Animation.easeOut (Animation.easePow 3.0))))
      { replace: [ Animation.Tween { to: 1.0, duration: 300.0 } ]
      , insert: []
      , update: []
      , remove: [] })
  where
    dragging = state.dragging
    draggingPosition = state.draggingPosition

    selected' :: Maybe Dragging -> Array (View Animation.Interval -> HTML)
    selected' Nothing             = []
    selected' (Just { selected }) = mapWithIndex (tabViewDragging state) selected

    width' :: Maybe Dragging -> String
    width' Nothing          = ""
    width' (Just { width }) = show width ++ "px"

    -- This causes it to be displayed on its own layer, so that we can
    -- move it around without causing a relayout or repaint
    transform :: Maybe Dragging -> Maybe DragEvent -> String
    transform (Just { offsetX, offsetY, left }) (Just { currentX, currentY }) =
      "translate3d(" ++
        show (fromMaybe (currentX - offsetX) left) ++ "px, " ++
        show (currentY - offsetY) ++ "px, 0px)"
    transform _ _ =
      "translate3d(0px, 0px, 0px)"


draggingTrait :: State -> Trait
draggingTrait state =
  style "cursor" (state >> notDragging >> mapIf "" "grabbing")


draggable :: State -> Group -> Tab -> Trait
draggable state group tab = trait
  [ onDrag
      {-
        // TODO should also support dragging when the type is "tag"
        mutable.get(group_type) === "window" &&
        !alt && !ctrl && !shift &&
        hypot(start_x - x, start_y - y) > 5
      -}
      { threshold: \e -> pure <<
          hypot (e.startX - e.currentX >> toNumber) (e.startY - e.currentY >> toNumber) > 5.0

      , start: \e -> runTransaction do
          {-
          const tabs = record.get(group, "tabs");

          const selected = list.make();

          list.each(stream.current(tabs), (x) => {
            if (mutable.get(record.get(x, "selected")) &&
                // TODO is this correct ?
                mutable.get(record.get(x, "visible"))) {
              list.push(selected, x);
            }
          });

          if (list.size(selected) === 0) {
            list.push(selected, tab);
          }

          list.each(selected, (tab) => {
            mutable.set(record.get(tab, "visible"), false);
          });

          // TODO hacky
          const height = (list.size(selected) === 1
                           ? tab_height
                           : (tab_height +
                              (Math["min"](list.size(selected), 4) * 3)));

          dragging_should_x = (mutable.get(opt("groups.layout")) !== "vertical");
          dragging_offset_x = (x - tab_box.left);
          dragging_offset_y = (tab_height / 2) + 1;

          mutable.set(dragging_dimensions, {
            x: (x - dragging_offset_x),
            y: (y - dragging_offset_y)
          });

          mutable.set(dragging_started, {
            selected: selected,
            width: Math["round"](tab_box.width)
          });

          drag_start({ group, tab, height });
          -}
          -- TODO check for visible ?
          isSelected <- tab.selected >> view >> currentValue

          selected <- if isSelected
            then do
              -- TODO make this faster ?
              tabs <- group.tabs >> MutableArray.get
              tabs >> filterM \x -> (view x.selected && view x.matchedSearch) >> currentValue
            else [tab] >> pure

          let len = length selected
          -- TODO (mutable.get(opt("groups.layout")) !== "vertical");
          let left = if false then Nothing else Just e.position.left
          let width = e.position.width
          -- TODO (tab_height + (Math["min"](list.size(selected), 4) * 3))
          let height = if len == 1 then tabHeight else tabHeight + ((min len 4) * 3)
          let offsetX = (width / 2)
          let offsetY = (tabHeight / 2) + 1

          for_ selected \a -> do
            a.dragging >> Mutable.set true

          state.dragging >> Mutable.set (Just { left, width, height, offsetX, offsetY, selected })
          state.draggingPosition >> Mutable.set (Just e)

          updateDragging state group tab height

      , move: \e -> runTransaction do
          state.draggingPosition >> Mutable.set (Just e)

      , end: \_ -> runTransaction do
          a <- state.dragging >> view >> currentValue
          -- TODO a bit gross
          case a of
            Nothing -> pure unit
            Just { selected } -> do
              for_ selected \b -> do
                b.dragging >> Mutable.set false

          state.dragging >> Mutable.set Nothing
          state.draggingPosition >> Mutable.set Nothing

          stopDragging state group } ]


tabView' :: State -> Tab -> View Animation.Interval -> View Boolean -> View Boolean -> Trait -> HTML
tabView' state tab animation isHovering visible trait = html "div"
  [ row
  , hidden (not visible)
  , menuItemTrait state isHovering (tab.selected >> view)
  , style "width" "100%"
  , style "padding" "1px"
  , style "border-radius" "5px"
  , style "font-weight" (isHovering >> mapIfTrue "bold")
  , trait ]
  [ html "div"
      [ stretch
      -- TODO what about dragging ?
      , property "title" tab.title
      , style "padding-left" "3px"
      , style "padding-right" "1px"
      -- TODO make this more efficient ?
      , style "transform" (animation >> map (Animation.range (-90.0) 0.0 >>> \t -> "rotateX(" ++ show t ++ "deg)")) ]
      [ text
          (tab.unloaded >> view >> map \unloaded ->
            if unloaded
            then (if tab.title == ""
              then "➔"
              else "➔ " ++ tab.title)
            else tab.title) ] ]


tabViewDragging :: State -> Int -> Tab -> View Animation.Interval -> HTML
tabViewDragging state index tab animation =
  tabView' state tab (pure (Animation.Interval 1.0)) (pure (index == 0)) (pure true) << trait
    [ style "height" (show tabHeight ++ "px")
    , style "z-index" (show (-index))
    , style "opacity"
        (if index < 5
         then pure ""
         else animation >> map (Animation.range 1.0 0.0 >>> show))
    , style "margin-top"
        (if index == 0
         then pure ""
         else if index < 5
         then animation >> map (Animation.rangeRoundSuffix 0 (-(tabHeight - 2)) "px")
         else animation >> map (Animation.rangeRoundSuffix 0 (-tabHeight) "px")) ]


tabView :: State -> Group -> View (Maybe Int) -> Tab -> View Animation.Interval -> HTML
tabView state group index tab animation = widget \state' -> do
  {-a <- Animation.make { duration: 5000.0 }

  --"Widget before" >> spy >> pure
  state' >> afterInsert do
    --"afterInsert" >> spy >> pure
    a >> Animation.tweenTo 1.0
  --"Widget after" >> spy >> pure
  state' >> beforeRemove do
    --"beforeRemove" >> spy >> pure
    a >> Animation.tweenTo 0.0-}

  --state' >> keepUntil (a >> view >> is 0.0)

  -- TODO don't use runTransaction ?
  isHovering <- Mutable.make false >> runTransaction

  let height      = animation >> map (Animation.rangeRoundSuffix 0 tabHeight "px")
  let borderWidth = animation >> map (Animation.rangeRoundSuffix 0 1 "px")
  let padding     = animation >> map (Animation.rangeRoundSuffix 0 1 "px")
  let opacity     = animation >> map (Animation.range 0.0 1.0 >>> show)
  -- This needs to match the "margin-left" in "Group.purs"
  let marginLeft  = animation >> map (Animation.rangeRoundSuffix 12 0 "px")

  pure << tabView' state tab animation
    (view isHovering && (state >> notDragging))
    (isVisible tab) << trait
    [ onHoverSet isHovering
    , draggable state group tab
    , onLeftClick \{ ctrl } -> runTransaction do
        (if ctrl
         then tab.selected >> Mutable.modify not
         else pure unit)
    , onMiddleClick \{ shift, ctrl, alt } -> runTransaction do
        (if not shift && not ctrl && not alt
         then do
           i <- index >> currentValue
           case i of
             Nothing ->
               pure unit
             Just i ->
               group.tabs >> MutableArray.deleteAt i
         else pure unit)

    , style "height" height
    , style "border-top-width" borderWidth
    , style "border-bottom-width" borderWidth
    , style "padding-top" padding
    , style "padding-bottom" padding
    , style "opacity" opacity
    , style "margin-left" marginLeft

    {-, style "background-color"
        (animation >> map \t ->
          hsl (Animation.rangeRound 0 360 t) 50 (Animation.rangeRound 50 100 t))-}

    -- TODO is this correct ?
    , style "overflow" "hidden"
    , style "position" (view tab.top >> map (ifJust "absolute" ""))
    , style "transform" (view tab.top >> map transform) ]
    where
      transform Nothing    = ""
      transform (Just top) = "translate3d(0px, " ++ show top ++ "px, 0px)"
