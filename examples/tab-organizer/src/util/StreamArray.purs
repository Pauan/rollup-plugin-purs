module Pauan.StreamArray
  ( module Pauan.StreamArray.Class
  , arrayDelta
  , eachDelta
  , mapWithIndex
  ) where

import Pauan.StreamArray.Class (StreamArray(..), ArrayDelta(..), class ToStreamArray, streamArray)

import Prelude
import Pauan.Mutable as Mutable
import Data.Maybe (Maybe(..))
import Pauan.View (View, view)
import Pauan.Stream (each)
import Control.Monad.Eff (Eff)
import Pauan.Resource (Resource)
import Data.Function.Uncurried (Fn7, runFn7, Fn8, runFn8)
import Pauan.Transaction (Transaction, runTransaction)
import Data.Traversable (sequence_)
import Control.Monad.Eff.Exception (Error)


arrayDelta :: forall a b.
  (Array a -> b) ->
  (Int -> a -> b) ->
  (Int -> a -> b) ->
  (Int -> b) ->
  ArrayDelta a ->
  b
arrayDelta replace _ _ _ (Replace a) = replace a
arrayDelta _ insert _ _ (Insert i a) = insert i a
arrayDelta _ _ update _ (Update i a) = update i a
arrayDelta _ _ _ remove (Remove i)   = remove i


eachDelta :: forall a eff.
  (ArrayDelta a -> Eff eff Unit) ->
  (Error -> Eff eff Unit) ->
  Eff eff Unit ->
  StreamArray a ->
  Eff eff Resource
eachDelta onValue onError onComplete (StreamArray s) = each onValue onError onComplete s


foreign import mapWithIndexImpl :: forall a b eff.
  Fn7
  ((ArrayDelta a -> Eff eff Unit) ->
   (Error -> Eff eff Unit) ->
   Eff eff Unit ->
   StreamArray a ->
   Eff eff Resource)
  ((Array a -> Eff eff Unit) ->
   (Int -> a -> Eff eff Unit) ->
   (Int -> a -> Eff eff Unit) ->
   (Int -> Eff eff Unit) ->
   ArrayDelta a ->
   Eff eff Unit)
  (Maybe Int -> Eff (mutable :: Mutable.MUTABLE | eff) (Mutable.Mutable (Maybe Int)))
  (Mutable.Mutable (Maybe Int) -> View (Maybe Int))
  ((Maybe Int -> Maybe Int) -> Mutable.Mutable (Maybe Int) -> Transaction (mutable :: Mutable.MUTABLE | eff) Unit)
  (Maybe Int -> Mutable.Mutable (Maybe Int) -> Transaction (mutable :: Mutable.MUTABLE | eff) Unit)
  (Array (Transaction eff Unit) -> Eff eff Unit)
  (Fn8
    (Array b -> ArrayDelta b)
    (Int -> b -> ArrayDelta b)
    (Int -> b -> ArrayDelta b)
    (Int -> ArrayDelta b)
    (Int -> Maybe Int)
    (Maybe Int)
    (Maybe Int -> Maybe Int)
    (Maybe Int -> Maybe Int)
    ((View (Maybe Int) -> a -> b) ->
     StreamArray a ->
     StreamArray b))

mapWithIndex :: forall a b. (View (Maybe Int) -> a -> b) -> StreamArray a -> StreamArray b
mapWithIndex = runFn8 (runFn7 mapWithIndexImpl
  eachDelta
  arrayDelta
  -- TODO make this more efficient ?
  (Mutable.make >>> runTransaction)
  view
  Mutable.modify
  Mutable.set
  runTransactions)
  Replace
  Insert
  Update
  Remove
  Just
  Nothing
  (map (_ + 1))
  (map (_ - 1))
  where
    runTransactions :: forall eff. Array (Transaction eff Unit) -> Eff eff Unit
    runTransactions = sequence_ >>> runTransaction
