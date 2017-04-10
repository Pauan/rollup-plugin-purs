module Pauan.View (class ToView, View, view, observe, currentValue) where

import Prelude
import Data.HeytingAlgebra (implies, ff, tt)
import Control.Apply (lift2)
import Control.Monad.Eff (Eff)
import Pauan.Resource (Resource)
import Pauan.Transaction (Transaction)
import Pauan.Stream (class ToStream, make, stream)
import Pauan.StreamArray.Class (class ToStreamArray, StreamArray(..), ArrayDelta(..))


foreign import data View :: Type -> Type

foreign import currentValue :: forall a eff. View a -> Transaction eff a

foreign import observe :: forall a eff. (a -> Eff eff Unit) -> View a -> Eff eff Resource


-- TODO move `f` to the end, so that newtype deriving works ?
class ToView f a | f -> a where
  view :: f -> View a


instance toStreamView :: ToStream (View a) a where
  stream view = make \onValue _ _ ->
    observe onValue view

-- TODO this is inefficient, figure out a better way
instance toStreamArrayView :: ToStreamArray (View (Array a)) a where
  streamArray view = StreamArray (map Replace (stream view))


-- TODO is this a good idea ?
{-instance viewView :: ToView (View a) a where
  view = id-}


-- TODO verify that this is correct and follows the laws
instance heytingView :: (HeytingAlgebra a) => HeytingAlgebra (View a) where
  not = map not
  disj = lift2 disj
  conj = lift2 conj
  implies = lift2 implies
  ff = pure ff
  tt = pure tt

instance booleanView :: (BooleanAlgebra a) => BooleanAlgebra (View a)


foreign import mapImpl :: forall a b. (a -> b) -> View a -> View b

instance functorView :: Functor View where
  map = mapImpl


foreign import applyImpl :: forall a b. View (a -> b) -> View a -> View b

instance applyView :: Apply View where
  apply = applyImpl


foreign import bindImpl :: forall a b. View a -> (a -> View b) -> View b

instance bindView :: Bind View where
  bind = bindImpl


foreign import pureImpl :: forall a. Unit -> a -> View a

instance applicativeView :: Applicative View where
  pure = pureImpl unit


instance monadView :: Monad View
