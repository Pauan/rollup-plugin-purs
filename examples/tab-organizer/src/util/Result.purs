module Pauan.Result (Result(..)) where

import Prelude
import Data.Bifunctor (class Bifunctor)
import Control.Extend (class Extend)


data Result a b
  = Failure a
  | Success b


-- TODO unit tests
derive instance eqResult :: (Eq a, Eq b) => Eq (Result a b)


-- TODO unit tests
instance functorResult :: Functor (Result e) where
  map f (Success a) = Success (f a)
  map _ (Failure a) = Failure a


-- TODO unit tests
instance applyResult :: Apply (Result e) where
  apply (Failure a) _ = Failure a
  apply (Success f) a = map f a


-- TODO unit tests
instance bindResult :: Bind (Result e) where
  bind (Success a) f = f a
  bind (Failure a) _ = Failure a


-- TODO unit tests
instance applicativeResult :: Applicative (Result e) where
  pure = Success


-- TODO unit tests
instance monadResult :: Monad (Result e)


-- TODO unit tests
instance bifunctorResult :: Bifunctor Result where
  bimap f _ (Failure a) = Failure (f a)
  bimap _ f (Success a) = Success (f a)


-- TODO unit tests
instance extendResult :: Extend (Result e) where
  extend _ (Failure a) = Failure a
  extend f x           = Success (f x)
