const dotenv = require('dotenv')
dotenv.config()

const { Config, System } = require('simplyapi')
const { Util } = require('simplyapi')
const { initializeCache, determineAction, insertFront, removeFront, updateCustomStatus } = require('./dataManager')

const {
    isMainThread,
    BroadcastChannel,
    Worker
} = require('node:worker_threads')

let e
main = () => {
    initiateWorkerPool()
}

// Queue
const async = require('async')
const queue = async.queue((task, completed) => {
    let error = { status: false, message: '' }
    update(task.data)
        .catch(err => {
            error.status = true
            error.message = err
        })
    completed(error, task)

}, Config.max_workers)

initiateWorkerPool = () => {
    // Worker Pool
    const bc = new BroadcastChannel('plural')

    if (isMainThread) {
        openWebSocket()

        bc.onmessage = (event) => {
            //console.log('::SimplyWS:: received message from worker')
            queue.push(event.data, (error, task) => {
                if (error.status) {
                    console.log(`An error occurred while processing task ${error.message}`)
                }
            })
        }
        for (let n = 0; n < Config.max_workers; n++)
            new Worker(__filename)
    }
}

// Socket
openWebSocket = () => {
    const WebSocketClient = require('./WebsocketClient')
    const wss = new WebSocketClient(Config.socket)
    let initialPacket = { "op": "authenticate", "token": Config.token }
    wss.onOpen = (_) => { wss.send(JSON.stringify(initialPacket)); }
    wss.onClose = (e) => { console.log('SimplyWS/onClose :: %s', e); e = '' }
    wss.onError = (e) => { console.log('SimplyWS/onError :: %s', e) }

    const bc = new BroadcastChannel('plural')
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
                initializeCache()
                bc.postMessage({data: data})
                break
            default:
                //unrecognizedMessage(data.msg)
                break
        }
    }
}

// Data Processing
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