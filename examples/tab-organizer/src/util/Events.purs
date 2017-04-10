module Pauan.Events (Events, makeBroadcaster, broadcast, receive, class ToEvents, events, Broadcaster) where

import Prelude
import Control.Monad.Eff (Eff)
import Pauan.Resource (Resource)
--import Data.Filterable (class Filterable, filterDefault, partitionDefault)
import Data.Maybe (Maybe, maybe)
import Data.Either (Either, either)
import Data.Function.Uncurried (Fn2, Fn3, runFn2, runFn3)


-- TODO move `f` to the end, so that newtype deriving works ?
class ToEvents f a | f -> a where
  events :: f -> Events a


foreign import data Events :: Type -> Type

foreign import receiveImpl :: forall a eff. (a -> Eff eff Unit) -> Events a -> Eff eff Resource

receive :: forall a eff. (a -> Eff eff Unit) -> Events a -> Eff eff Resource
receive = receiveImpl


foreign import mapImpl :: forall a b. (a -> b) -> Events a -> Events b

instance functorEvents :: Functor Events where
  map = mapImpl


foreign import filterMapImpl :: forall a b eff.
  Fn2
    (Eff eff Unit)
    (Eff eff Unit -> (b -> Eff eff Unit) -> Maybe b -> Eff eff Unit)
    ((a -> Maybe b) ->
     Events a ->
     Events b)

foreign import partitionMapImpl :: forall a b l r eff.
  Fn3
    (Events l -> Events r -> { left :: Events l, right :: Events r })
    (b -> Eff eff Unit)
    ((l -> Eff eff Unit) -> (r -> Eff eff Unit) -> Either l r -> Eff eff Unit)
    ((a -> Either l r) ->
     Events a ->
     { left :: Events l, right :: Events r })

{-instance filterableEvents :: Filterable Events where
  -- TODO implement these faster ?
  filter a = filterDefault a
  partition a = partitionDefault a
  filterMap = runFn2 filterMapImpl (pure unit) maybe
  partitionMap = runFn3 partitionMapImpl { left: _, right: _ } (const (pure unit)) either-}


foreign import data Broadcaster :: Type -> Type

foreign import makeBroadcaster :: forall a eff. Eff eff (Broadcaster a)


foreign import eventsImpl :: forall a. Unit -> Broadcaster a -> Events a

instance eventsBroadcaster :: ToEvents (Broadcaster a) a where
  events = eventsImpl unit


foreign import broadcastImpl :: forall a eff. Unit -> a -> Broadcaster a -> Eff eff Unit

broadcast :: forall a eff. a -> Broadcaster a -> Eff eff Unit
broadcast = broadcastImpl unit
