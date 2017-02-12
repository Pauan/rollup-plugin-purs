module Pauan.Panel.View.Group where

import Pauan.Prelude
import Pauan.Mutable as Mutable
import Pauan.MutableArray as MutableArray
import Pauan.Panel.Types (Tab, Group, State, makeState)
import Pauan.Panel.View.Tab (draggingTrait, draggingView, tabView)
import Pauan.HTML (render)
import Pauan.Animation as Animation
import Pauan.StreamArray (mapWithIndex)


groupView :: State -> View (Maybe Int) -> Group -> View Animation.Interval -> HTML
groupView state index group animation =
  html "div"
    [ style "height" (group.height >> view >> map \a ->
        case a of
          Nothing -> ""
          Just a' -> show a' ++ "px") ]
    -- TODO make this more efficient ?
    (group.tabs >> streamArray >> mapWithIndex (tabView state group) >> Animation.animatedMap
      (\animation f -> f animation) --(animation >> map (Animation.easeInOut (Animation.easePow 2.0))))
      { replace: [ Animation.Jump { to: 1.0 } ]
      , insert: [ Animation.Tween { to: 1.0, duration: 500.0 } ]
      , update: []
      , remove: [ Animation.Tween { to: 0.0, duration: 500.0 } ] })
