module Pauan.Stream (Stream, class ToStream, stream, make, each, filter, merge, scanl) where

import Prelude
import Control.Monad.Eff (Eff)
import Pauan.Resource (Resource)
import Data.Traversable (class Traversable, traverse_)
import Data.Function.Uncurried (Fn3, runFn3, mkFn3)
import Control.Monad.Eff.Exception (Error)


foreign import data Stream :: * -> *


-- TODO move `f` to the end, so that newtype deriving works ?
class ToStream f a | f -> a where
  stream :: f -> Stream a


{-foreign import streamArrayImpl :: forall eff e a. Unit -> Array a -> Stream eff e a

instance toStreamArray :: ToStream (Array a) eff e a where
  stream = streamArrayImpl unit-}


{-foreign import streamTraverseImpl :: forall eff e a t.
  Unit ->
  ((a -> Eff eff Unit) -> t a -> Eff eff Unit) ->
  t a ->
  Stream eff e a

-- TODO somehow use Foldable instead ?
-- TODO this should not traverse Arrays from right-to-left
instance toStreamTraversable :: (Traversable t) => ToStream (t a) eff e a where
  stream = streamTraverseImpl unit traverse_-}


foreign import makeImpl :: forall eff a.
  (Fn3
    (a -> Eff eff Unit)
    (Error -> Eff eff Unit)
    (Eff eff Unit)
    (Eff eff Resource)) ->
  Stream a

make :: forall a eff.
  ((a -> Eff eff Unit) ->
   (Error -> Eff eff Unit) ->
   Eff eff Unit ->
   Eff eff Resource) ->
  Stream a
make f = makeImpl (mkFn3 f)


foreign import eachImpl :: forall eff a.
  (a -> Eff eff Unit) ->
  (Error -> Eff eff Unit) ->
  Eff eff Unit ->
  Stream a ->
  Eff eff Resource

each :: forall a eff.
  (a -> Eff eff Unit) ->
  (Error -> Eff eff Unit) ->
  Eff eff Unit ->
  Stream a ->
  Eff eff Resource
each = eachImpl


foreign import mapImpl :: forall a b. (a -> b) -> Stream a -> Stream b

instance functorStream :: Functor Stream where
  map = mapImpl


foreign import filterImpl :: forall a.
  Unit ->
  (a -> Boolean) ->
  Stream a ->
  Stream a

filter :: forall a.
  (a -> Boolean) ->
  Stream a ->
  Stream a
filter = filterImpl unit


foreign import mergeImpl :: forall a.
  Unit ->
  Stream a ->
  Stream a ->
  Stream a

merge :: forall a. Stream a -> Stream a -> Stream a
merge = mergeImpl unit


foreign import scanlImpl :: forall a b.
  (b -> a -> b) ->
  b ->
  Stream a ->
  Stream b

scanl :: forall a b.
  (b -> a -> b) ->
  b ->
  Stream a ->
  Stream b
scanl = scanlImpl
