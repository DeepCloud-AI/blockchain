'use strict';

/**Created when a user adds his resource or application to the platform and deposits a 
   caution amount, which will be released back once his resource/application is deleted
   from platform.
**/
var TransactionContent = function(transaction) {
    if (transaction) {
        var transactionObj = JSON.parse(transaction);
        this.from = transactionObj.from;
        this.assertId = transactionObj.assertId;
        this.amount = new BigNumber(transactionObj.amount);
        // 1 - Resource, 2 - Application
        // TODO: Can be changed to enum
        this.assertType = transactionObj.assertType;
        this.isRefunded = (transactionObj.isRefunded != null ? transactionObj.isRefunded : 0);
        this.escrow = transactionObj.escrow;
        this.paymentId = transactionObj.paymentId;
        this.refundId = transactionObj.refundId;
    } else {
        this.from = null;
        this.to = null;
        this.amount = new BigNumber(0);
        this.assertType = null;
        this.isRefunded = 0;
        this.escrow = null;
        this.paymentId = null;
        this.refundId = null;
    }
};

TransactionContent.prototype = {
    toString: function() {
        return JSON.stringify(this);
    }
};

var LockerContent = function(text) {
    if (text) {
        var obj = JSON.parse(text);
        this.balance = new BigNumber(obj.balance);
    } else {
        this.balance = new BigNumber(0);
    }
};

LockerContent.prototype = {
    toString: function() {
        return JSON.stringify(this);
    }
};

var EscrowContract = function() {
    LocalContractStorage.defineProperties(this, {
        _escrowAccount: null
    });

    LocalContractStorage.defineMapProperty(this, "transactionVault", {
        parse: function(text) {
            return new TransactionContent(text);
        },
        stringify: function(obj) {
            return obj.toString();
        }
    });

    LocalContractStorage.defineMapProperty(this, "lockVault", {
        parse: function(text) {
            return new LockerContent(text);
        },
        stringify: function(obj) {
            return obj.toString();
        }
    });
};

EscrowContract.prototype = {
    init: function(escrowAccount) {
        this._escrowAccount = escrowAccount;
    },

    getEscrowAddress: function() {
        return this._escrowAccount;
    },

    // Will be called first time when user adds his resource or application to the platform.
    createTransaction: function(transactionId, from, assertId, assertType, value, paymentId) {
        if (Blockchain.transaction.from === this._escrowAccount) {
            throw new Error('Transaction not valid, sender must be non-escrow account');
        }
        var amount = new BigNumber(value);
        if (!transactionId) {
            throw new Error('Invalid transaction id');
        }
        if (this._verifyAddress(from) === 0) {
            throw new Error('Invalid from address');
        }
        if (this._verifyAssertType(assertType) === 0) {
            throw new Error('Invalid assert type, must be either 1(resource) or 2(application)');
        }
        if (amount.lt(0.0)) {
            throw new Error('Invalid amount');
        }
        var transaction = new TransactionContent();
        transaction.from = from;
        transaction.assertId = assertId;
        transaction.paymentId = paymentId;
        transaction.assertType = assertType;
        transaction.amount = amount;
        transaction.escrow = this._escrowAccount;        
        this.transactionVault.put(transactionId, transaction);
        this._lock(from, amount);
    },
    
    // Will be called when a resource or application is deleted and the owner needs his deposit back.
    releaseAmount: function(transactionId, refundId) {
        if (!transactionId) {
            throw new Error('Invalid transaction id');
        }
        var transaction = this.transactionVault.get(transactionId);
        if (transaction) {
            if (Blockchain.transaction.from !== transaction.escrow) {
                throw new Error('Invalid sender, must be the escrow who created the transaction');
            }
            // refund to the amount sender 
            this._release(transaction.from, transaction.from, transaction.amount);
            transaction.isRefunded = 1;
            transaction.refundId = refundId;
            this.transactionVault.put(transactionId, transaction);
        } else {
            throw new Error('Transaction not found ');
        }
    },

    // Call this when we want to get total deposit by a user at any point of time for his multiple assets
    amountLocked: function(accountId) {
        return this.lockVault.get(accountId);
    },

    getTransaction: function(transactionId) {
        return this.transactionVault.get(transactionId);
    },

    // Transfer some amount from user account to our escrow account
    _lock: function(from, amount) {
        var value = amount;
        var existingEscrowLock = this.lockVault.get(from);
        if (existingEscrowLock) {
            value = value.plus(existingEscrowLock.balance);
        }
        var escrowLock = new LockerContent();
        escrowLock.balance = value;
        this.lockVault.put(from, escrowLock);
    },

    // Return back amount from escrow to the user
    _release: function(from, to, value) {
        var amount = new BigNumber(value);
        var escrowLock = this.lockVault.get(from);
        if (!escrowLock) {
            throw new Error("No amount locked");
        }
        if (amount.gt(escrowLock.balance)) {
            throw new Error("No sufficient amount locked before");
        }
        escrowLock.balance = escrowLock.balance.sub(amount);
        this.lockVault.put(from, escrowLock);
    },

    _verifyAddress: function(address) {
        // 1-valid, 0-invalid
        var result = Blockchain.verifyAddress(address);
        return {
            valid: result == 0 ? false : true
        };
    },

    _verifyAssertType: function(type) {
        // 1-valid, 0-invalid       
        return {
            valid: (type==1 || type==2) ? true : false
        };
    }
};

module.exports = EscrowContract;
