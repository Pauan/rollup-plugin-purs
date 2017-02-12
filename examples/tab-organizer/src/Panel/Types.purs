module Pauan.Panel.Types where

import Pauan.Prelude
import Pauan.Mutable as Mutable'
import Pauan.Mutable (Mutable, MUTABLE)
import Pauan.MutableArray as MutableArray'
import Pauan.MutableArray (MutableArray)


type State =
  { groups :: MutableArray Group
  , dragging :: Mutable (Maybe Dragging)
  , draggingAnimate :: Mutable Boolean
  , draggingPosition :: Mutable (Maybe DragEvent) }


type Group =
  { tabs :: MutableArray Tab
  , height :: Mutable (Maybe Int) }


type Tab =
  { id :: String
  , url :: String
  , title :: String
  , top :: Mutable (Maybe Int)
  , matchedSearch :: Mutable Boolean
  , dragging :: Mutable Boolean
  , selected :: Mutable Boolean
  , unloaded :: Mutable Boolean }


type Dragging =
  { left :: (Maybe Int)
  , width :: Int
  , height :: Int
  , offsetX :: Int
  , offsetY :: Int
  , selected :: Array Tab }


isVisible :: Tab -> View Boolean
isVisible tab = view tab.matchedSearch && not (view tab.dragging)


notDragging :: State -> View Boolean
notDragging = _.dragging >>> view >>> map (isJust >>> not)


makeState :: forall eff. Transaction (mutable :: MUTABLE | eff) State
makeState = do
  groups <- MutableArray'.make []
  dragging <- Mutable'.make Nothing
  draggingAnimate <- Mutable'.make false
  draggingPosition <- Mutable'.make Nothing
  pure { groups, dragging, draggingAnimate, draggingPosition }


-- TODO incomplete
updateDragging :: forall eff. State -> Group -> Tab -> Int -> Transaction (mutable :: MUTABLE | eff) Unit
updateDragging state group tab height = do
  -- TODO use a pure fold instead
  top <- Mutable'.make 0

  tabs <- group.tabs >> MutableArray'.get

  for_ tabs \x -> do
    (if x.id == tab.id
     then top >> Mutable'.modify (_ + height)
     else pure unit)

    visible <- x >> isVisible >> currentValue

    (if visible
     then do
       t <- top >> Mutable'.get
       x.top >> Mutable'.set (Just t)
       top >> Mutable'.modify (_ + 20)
     else pure unit)

  t <- top >> Mutable'.get
  group.height >> Mutable'.set (Just t)


stopDragging :: forall eff. State -> Group -> Transaction (mutable :: MUTABLE | eff) Unit
stopDragging state group = do
  tabs <- group.tabs >> MutableArray'.get

  for_ tabs \x -> do
    x.top >> Mutable'.set Nothing

  group.height >> Mutable'.set Nothing

  state.draggingAnimate >> Mutable'.set false
