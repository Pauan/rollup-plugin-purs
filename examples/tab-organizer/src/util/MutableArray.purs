module Pauan.MutableArray (MutableArray, make, get, set, insertAt, updateAt, deleteAt, push) where

import Prelude
import Data.Maybe (fromMaybe)
import Pauan.StreamArray (ArrayDelta(..), class ToStreamArray, StreamArray(..))
import Data.Array as Array
import Pauan.Stream as Stream
import Pauan.Mutable as Mutable
import Pauan.Events as Events
import Pauan.Transaction (Transaction, onCommit, runTransaction)
import Pauan.Transaction.Unsafe (unsafeLiftEff)


data MutableArray a =
  MutableArray (Mutable.Mutable (Array a)) (Events.Broadcaster (ArrayDelta a))


instance toStreamArrayMutableArray :: ToStreamArray (MutableArray a) a where
  streamArray (MutableArray mut events) = StreamArray
   (Stream.make \onValue _ _ -> do
      -- TODO make this faster ?
      value <- runTransaction (Mutable.get mut)
      onValue (Replace value)
      Events.receive onValue (Events.events events))


make :: forall a eff. Array a -> Transaction (mutable :: Mutable.MUTABLE | eff) (MutableArray a)
make value = do
  mutable <- Mutable.make value
  -- TODO make this more efficient ?
  -- TODO figure out another way of doing this ?
  events <- unsafeLiftEff Events.makeBroadcaster
  pure (MutableArray mutable events)


get :: forall a eff. MutableArray a -> Transaction (mutable :: Mutable.MUTABLE | eff) (Array a)
get (MutableArray mut _) = Mutable.get mut


set :: forall a eff. Array a -> MutableArray a -> Transaction (mutable :: Mutable.MUTABLE | eff) Unit
set value (MutableArray mut events) = do
  Mutable.set value mut
  onCommit (Events.broadcast (Replace value) events)


insertAt :: forall a eff. Int -> a -> MutableArray a -> Transaction (mutable :: Mutable.MUTABLE | eff) Unit
insertAt index value (MutableArray mut events) = do
  -- TODO make this faster
  -- TODO error if it's Nothing
  Mutable.modify (\array -> fromMaybe array (Array.insertAt index value array)) mut
  onCommit (Events.broadcast (Insert index value) events)


updateAt :: forall a eff. Int -> a -> MutableArray a -> Transaction (mutable :: Mutable.MUTABLE | eff) Unit
updateAt index value (MutableArray mut events) = do
  -- TODO make this faster
  -- TODO error if it's Nothing
  Mutable.modify (\array -> fromMaybe array (Array.updateAt index value array)) mut
  onCommit (Events.broadcast (Update index value) events)


deleteAt :: forall a eff. Int -> MutableArray a -> Transaction (mutable :: Mutable.MUTABLE | eff) Unit
deleteAt index (MutableArray mut events) = do
  -- TODO make this faster
  -- TODO error if it's Nothing
  Mutable.modify (\array -> fromMaybe array (Array.deleteAt index array)) mut
  onCommit (Events.broadcast (Remove index) events)


push :: forall a eff. a -> MutableArray a -> Transaction (mutable :: Mutable.MUTABLE | eff) Unit
push value (MutableArray mut events) = do
  array <- Mutable.get mut
  Mutable.set (Array.snoc array value) mut
  onCommit (Events.broadcast (Insert (Array.length array) value) events)
