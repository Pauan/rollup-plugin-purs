module Pauan.StreamArray.Class
  ( StreamArray(..)
  , ArrayDelta(..)
  , class ToStreamArray
  , streamArray
  ) where

import Prelude
import Pauan.Stream (class ToStream, Stream, scanl)
import Data.Maybe (fromMaybe)
import Data.Array (insertAt, updateAt, deleteAt)


data ArrayDelta a
  = Replace (Array a)
  | Insert Int a
  | Update Int a
  | Remove Int


newtype StreamArray a = StreamArray (Stream (ArrayDelta a))


-- TODO move `f` to the end, so that newtype deriving works ?
class ToStreamArray f a | f -> a where
  streamArray :: f -> StreamArray a


instance toStreamArray :: ToStream (StreamArray a) (Array a) where
  stream (StreamArray s) = scanl (\old delta ->
    case delta of
      Replace a -> a
      -- TODO is `fromMaybe` correct ?
      -- TODO throw an error if it is Nothing ?
      Insert i a -> fromMaybe old (insertAt i a old)
      Update i a -> fromMaybe old (updateAt i a old)
      Remove i -> fromMaybe old (deleteAt i old)) [] s


instance functorStream :: Functor StreamArray where
  map f (StreamArray s) = StreamArray
    (map (\delta ->
      case delta of
        Replace a -> Replace (map f a)
        Insert i a -> Insert i (f a)
        Update i a -> Update i (f a)
        Remove i -> Remove i) s)
