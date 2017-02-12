module Pauan.Resource (Resource(..), cleanup, using, usingResource) where

import Prelude
import Control.Monad.Eff (Eff)


newtype Resource = Resource (forall eff. Eff eff Unit)


cleanup :: forall eff. Resource -> Eff eff Unit
cleanup (Resource a) = a


-- TODO move this someplace else, like purescript-exceptions
foreign import usingImpl :: forall eff a b. Eff eff a -> (a -> Eff eff b) -> (a -> Eff eff Unit) -> Eff eff b

using :: forall eff a b. Eff eff a -> (a -> Eff eff b) -> (a -> Eff eff Unit) -> Eff eff b
using = usingImpl


usingResource :: forall eff a. Eff eff Resource -> Eff eff a -> Eff eff a
usingResource a b = using a (const b) cleanup
