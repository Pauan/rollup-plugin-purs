module Pauan.Animation
  ( Animation
  , Interval(..)
  , make
  , range
  , rangeRound
  , rangeSuffix
  , rangeRoundSuffix
  , easePow
  , easeSinusoidal
  , easeExponential
  , easeCircular
  , easeOut
  , easeInOut
  , easeRepeat
  , AnimationSetting(..)
  , AnimationSettings
  , animatedMap
  ) where

import Prelude
import Control.Monad.Eff (Eff)
import Pauan.View (class ToView, View, view)
import Pauan.Transaction (Transaction, runTransaction, runTransactions, onCommit)
import Data.Generic (class Generic, gEq, gShow, gCompare)
import Pauan.Resource (Resource)
import Data.Int (round, toNumber)
import Data.Array (foldr)
import Pauan.StreamArray (ArrayDelta(..), StreamArray, eachDelta, arrayDelta)
import Data.Function.Uncurried (Fn9, runFn9)
import Control.Monad.Eff.Exception (Error)
import Pauan.Mutable as Mutable


foreign import data Animation :: *


newtype Interval = Interval Number

derive instance genericInterval :: Generic Interval

-- TODO replace with Newtype or whatever
instance showInterval :: Show Interval where
  show = gShow

instance eqInterval :: Eq Interval where
  eq = gEq

instance ordInterval :: Ord Interval where
  compare = gCompare


foreign import makeImpl :: forall eff.
  Transaction (mutable :: Mutable.MUTABLE | eff) (Mutable.Mutable Interval) ->
  Transaction (mutable :: Mutable.MUTABLE | eff) Animation

make :: forall eff. Transaction (mutable :: Mutable.MUTABLE | eff) Animation
make = makeImpl (Mutable.make (Interval 0.0))


foreign import viewImpl ::
  (Mutable.Mutable Interval -> View Interval) ->
  Animation ->
  View Interval

instance toViewAnimation :: ToView Animation Interval where
  view = viewImpl view


foreign import jumpToImpl :: forall eff.
  (Interval -> Mutable.Mutable Interval -> Transaction (mutable :: Mutable.MUTABLE | eff) Unit) ->
  Number ->
  Animation ->
  Transaction (mutable :: Mutable.MUTABLE | eff) Unit

jumpTo :: forall eff. Number -> Animation -> Transaction (mutable :: Mutable.MUTABLE | eff) Unit
jumpTo = jumpToImpl Mutable.set


foreign import tweenToImpl :: forall eff.
  (Interval -> Mutable.Mutable Interval -> Transaction (mutable :: Mutable.MUTABLE | eff) Unit) ->
  (Array (Transaction eff Unit) -> Eff eff Unit) ->
  Unit ->
  Number ->
  Number ->
  Animation ->
  Transaction (mutable :: Mutable.MUTABLE | eff) Unit->
  Transaction (mutable :: Mutable.MUTABLE | eff) Unit

tweenTo :: forall eff.
  Number ->
  Number ->
  Animation ->
  Transaction (mutable :: Mutable.MUTABLE | eff) Unit ->
  Transaction (mutable :: Mutable.MUTABLE | eff) Unit
tweenTo = tweenToImpl Mutable.set runTransactions unit


foreign import rangeImpl :: Number -> Number -> Interval -> Number

range :: Number -> Number -> Interval -> Number
range = rangeImpl


rangeRound :: Int -> Int -> Interval -> Int
rangeRound low high tween = round (range (toNumber low) (toNumber high) tween)


rangeSuffix :: Number -> Number -> String -> Interval -> String
-- TODO should this use show or something else ?
rangeSuffix from to suffix t = show (range from to t) <> suffix


rangeRoundSuffix :: Int -> Int -> String -> Interval -> String
-- TODO should this use show or something else ?
rangeRoundSuffix from to suffix t = show (rangeRound from to t) <> suffix


foreign import easePow :: Number -> Interval -> Interval

foreign import easeSinusoidal :: Interval -> Interval

foreign import easeExponential :: Interval -> Interval

foreign import easeCircular :: Interval -> Interval

foreign import easeOut :: (Interval -> Interval) -> Interval -> Interval

foreign import easeInOut :: (Interval -> Interval) -> Interval -> Interval

-- TODO should this be Int or Number ?
foreign import easeRepeat :: Int -> Interval -> Interval


data AnimationSetting
  = Jump { to :: Number }
  | Tween { to :: Number, duration :: Number }

type AnimationSettings =
  { replace :: Array AnimationSetting
  , insert :: Array AnimationSetting
  , update :: Array AnimationSetting
  , remove :: Array AnimationSetting }


animationSetting' :: forall eff.
  AnimationSetting ->
  Animation ->
  Transaction (mutable :: Mutable.MUTABLE | eff) Unit ->
  Transaction (mutable :: Mutable.MUTABLE | eff) Unit
animationSetting' (Jump { to }) animation done = do
  jumpTo to animation
  done
animationSetting' (Tween { to, duration }) animation done =
  tweenTo to duration animation done


-- TODO use Transaction rather than Eff ?
type Animator eff = Animation -> Eff (mutable :: Mutable.MUTABLE | eff) Unit -> Eff (mutable :: Mutable.MUTABLE | eff) Unit


animationSetting :: forall eff. Array AnimationSetting -> Animator eff
animationSetting a animation done =
  -- TODO is this correct ?
  runTransaction (foldr (\b -> animationSetting' b animation) (onCommit done) a)


foreign import animatedMapImpl :: forall a b eff.
  Fn9
  ((ArrayDelta a -> Eff eff Unit) -> (Error -> Eff eff Unit) -> Eff eff Unit -> StreamArray a -> Eff eff Resource)
  ((Array a -> Eff eff Unit) -> (Int -> a -> Eff eff Unit) -> (Int -> a -> Eff eff Unit) -> (Int -> Eff eff Unit) -> ArrayDelta a -> Eff eff Unit)
  (Animation -> View Interval)
  (Array b -> ArrayDelta b)
  (Int -> b -> ArrayDelta b)
  (Int -> b -> ArrayDelta b)
  (Int -> ArrayDelta b)
  Unit
  (Eff (mutable :: Mutable.MUTABLE | eff) Animation)
  ((View Interval -> a -> b) ->
   Animator eff ->
   Animator eff ->
   Animator eff ->
   Animator eff ->
   StreamArray a ->
   StreamArray b)

animatedMap' :: forall a b eff.
  (View Interval -> a -> b) ->
  Animator eff ->
  Animator eff ->
  Animator eff ->
  Animator eff ->
  StreamArray a ->
  StreamArray b
-- TODO don't use runTransaction ?
animatedMap' = runFn9 animatedMapImpl eachDelta arrayDelta view Replace Insert Update Remove unit (runTransaction make)

animatedMap :: forall a b. (View Interval -> a -> b) -> AnimationSettings -> StreamArray a -> StreamArray b
animatedMap f x = animatedMap'
  f
  (animationSetting x.replace)
  (animationSetting x.insert)
  (animationSetting x.update)
  (animationSetting x.remove)
