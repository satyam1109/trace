package com.tracemymoney.ledger

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider

class MoneyLedgerPackage : BaseReactPackage() {
    override fun getModule(name: String, context: ReactApplicationContext): NativeModule? =
        if (name == MoneyLedgerModule.NAME) MoneyLedgerModule(context) else null

    override fun getReactModuleInfoProvider() = ReactModuleInfoProvider {
        mapOf(MoneyLedgerModule.NAME to ReactModuleInfo(
            MoneyLedgerModule.NAME, MoneyLedgerModule.NAME, false, false, false, true
        ))
    }
}
