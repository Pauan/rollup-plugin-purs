module Pauan.Transaction.Unsafe (unsafeLiftEff) where

import Control.Monad.Eff (Eff)
import Pauan.Transaction (Transaction)


foreign import unsafeLiftEff :: forall a eff. Eff eff a -> Transaction eff a
