require("web3")

contract("InterledgerProxyImplementation", async accounts => {
    const InterledgerProxyImplementation = artifacts.require("InterledgerProxyImplementation")

    it("interledgerReceive()", async () => {
        let contract = await InterledgerProxyImplementation.new()
        let nonce = 1
        let inputData = web3.utils.toHex("A")
        let tx = await contract.interledgerReceive(nonce, inputData)
        let events = tx.logs
        assert.equal(events[0].event, "InterledgerDataReceived", "Event of the wrong type emitted.")
        assert.equal(events[0].args.data, inputData, "InterledgerDataReceived event emitted wrong payload.")
        assert.equal(events[1].event, "InterledgerEventAccepted", "Event of the wrong type emitted.")
        assert.equal(events[1].args.nonce, 1, "InterledgerEventAccepted event emitted wrong nonce.")
    })

    it("triggerInterledger()", async () => {
        let contract = await InterledgerProxyImplementation.new()
        let inputData = web3.utils.toHex("A")
        let tx = await contract.triggerInterledger(inputData)
        let events = tx.logs
        assert.equal(events[0].event, "InterledgerEventSending", "Event of the wrong type emitted.")
        assert.equal(events[0].args.id, 0, "InterledgerEventSending event emitted wrong ID.")
        assert.equal(events[0].args.data, inputData, "InterledgerEventSending event emitted wrong payload.")
    })
})