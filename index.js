const dotenv = require('dotenv')
dotenv.config()

const { Config, System } = require('SimplyAPI')
const { Util } = require('SimplyAPI')
const { initializeCache, determineAction, insertFront, removeFront, updateCustomStatus } = require('./dataManager')

let e
main = async () => {
    openWebSocket()
}

openWebSocket = async () => {
    const WebSocketClient = require('./WebsocketClient')
    const wss = new WebSocketClient(Config.socket);
    let initialPacket = { "op": "authenticate", "token": Config.token }
    wss.onOpen = (_) => { wss.send(JSON.stringify(initialPacket)); }
    wss.onClose = (e) => { console.log('SimplyWS/onClose :: %s', e); e = '' }
    wss.onError = (e) => { console.log('SimplyWS/onError :: %s', e) }

    wss.onMessage = (raw) => {
        e = raw
        let data = JSON.parse(e)
        if (Object.keys(data).length === 0) return

        switch (data.msg) {
            case "Successfully authenticated":
                console.log('::SimplyWS:: authenticated')
                // cache current front
                initializeCache()
                break
            case "Authentication violation: Token is missing or invalid. Goodbye :)":
                console.log('::SimplyWS:: invalid token, exiting..')
                process.exit(1)
            case "update":
                update(data)
                break
            default:
                //unrecognizedMessage(data.msg)
                break
        }
    }
}

update = async (data) => {
    let target = data.target
    switch (target) {
        case 'frontHistory':
            //response += 'Front has changed!'
            await Util.asyncForEach(data.results, async (o) => {
                let system = new System(Config)
                let member = await system.getMemberById(o.content.member)
                // insert
                if (o.operationType == "insert") {
                    insertFront(member)
                }
                else {
                    // get current fronters and patch the list
                    let frontData = await system.getFronters()
                    let action = await determineAction(o, frontData)
                    // if delete operation, remove the member from the list
                    switch (action) {
                        case "remove":
                            removeFront(member)
                            break

                        case "customStatus":
                            updateCustomStatus(member)
                            break
                    }
                }
            })
            break
        default:
            //unknownTarget(data.target)
            break
    }
}

main()