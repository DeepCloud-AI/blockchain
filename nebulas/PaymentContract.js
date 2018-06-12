'use strict';

/**Created when an application user has to pay to resource provider based on
   hours of usage.
**/

var PaymentContent = function(payment) {
    if (payment) {
        var paymentObj = JSON.parse(payment);
        this.from = paymentObj.from; // application user
        this.to = paymentObj.to; // beneficiary - resource provider
        this.amount = new BigNumber(paymentObj.amount);
        this.hours = paymentObj.hours; // No of hours resource is used by the application
        this.rate = paymentObj.rate; // Tokens per hour configured
        this.resourceId = paymentObj.resourceId;
        this.applicationId = paymentObj.applicationId;      
    } else {
        this.from = null;
        this.to = null;
        this.amount = new BigNumber(0);
        this.hours = 0;
        this.rate = 0;
        this.resourceId = null;
        this.applicationId = null;   
    }
};

PaymentContent.prototype = {
    toString: function() {
        return JSON.stringify(this);
    }
};

var PaymentContract = function() {
    LocalContractStorage.defineMapProperty(this, "paymentVault", {
        parse: function(text) {
            return new PaymentContent(text);
        },
        stringify: function(obj) {
            return obj.toString();
        }
    });    
};

PaymentContract.prototype = {
    init: function() {
        
    },

    createPayment: function(paymentId, to, hours, rate, amount, resourceId, applicationId) {
        var value = new BigNumber(amount);
        if (this._verifyAddress(Blockchain.transaction.from) === 0 || this._verifyAddress(to) === 0 || Blockchain.transaction.from === to) {
            throw new Error('Invalid from or to address');
        }
        if (value.lt(0.0)) {
            throw new Error('Invalid amount');
        }
        var payment = new PaymentContent()
        payment.from = Blockchain.transaction.from;
        payment.to = to;
        payment.amount = amount;
        payment.hours = hours;
        payment.rate = rate;
        payment.resourceId = resourceId;
        payment.applicationId = applicationId;       
        this.paymentVault.put(paymentId, payment);
    },

    getPayment: function(paymentId) {
        return this.paymentVault.get(paymentId);
    },   

    _verifyAddress: function(address) {
        // 1-valid, 0-invalid
        var result = Blockchain.verifyAddress(address);
        return {
            valid: result == 0 ? false : true
        };
    }
};

module.exports = PaymentContract;
