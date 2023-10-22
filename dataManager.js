const axios = require('axios')
const { Config, System, Util } = require('simplyapi')

const pkUrl = Config.pk_url
const pkHeader = {
    'Content-Type': 'application/json; charset=UTF-8',
    'Authorization': Config.pk_token
}

let cache = {}
async function initializeCache() {
    let system = new System(Config)
    cache.frontHistory = await system.getFronters()
}

function unknownTarget(target) {
    console.log('::SimplyWS:: Unknown update target: ' + target + '\n::SimplyWS:: Full message: ' + e)
}

function unrecognizedMessage(msg) {
    console.log('::SimplyWS:: Unrecognized message: ' + msg + '\n::SimplyWS:: Full message: ' + e)
}

async function getPKFronters() {
    let members = []
    let fronters = await axios.get(`${pkUrl}/systems/@me/fronters`, {
        headers: pkHeader
    })
        .catch((err) => {
            if (err.toJSON().status == 429)
                // Too many requests
                setTimeout(async () => {
                    return await getPKFronters()
                }, 1500)
        })

    if (fronters != undefined) {
        fronters.data.members.forEach((key, value) => {
            members.push(key.id)
        })
    }

    return members
}

async function findPrimary() {
    let found = false
    let system = new System(Config)
    let fronters = await system.getFronters()
    return new Promise(async (resolve) => {
        await Util.asyncForEach(fronters, async (fronter) => {
            if (fronter.content.customStatus) {
                if (fronter.content.customStatus.toLowerCase().includes("primary")) {
                    let member = await system.getMemberById(fronter.content.member)
                    resolve({ name: member.content.name, pkId: member.content.pkId })
                    found = true
                }
            }
        })

        if (!found)
            resolve(false)
    })
}

async function determineAction(eventData, frontData = []) {
    if (frontData.length == 0)
        return 'remove'
    let action = ''

    // check for cache
    if (!cache.frontHistory) {
        let system = new System(Config)
        let frontHistory = await system.getFronters()
        cache.frontHistory = frontHistory
    }

    // get the difference between cached history and current front
    let diff = await calculateDiff(cache.frontHistory, frontData)
    // we handle one thing at a time, although this should be expanded since you can modify multiple custom statuses at once
    if (diff.length >= 1) {
        if (diff[0].content.customStatus || eventData.content.customStatus || diff[0].content.customStatus == "" || eventData.content.customStatus == "") {
            // check if customStatus value is in cache
            let foundInCache = Object.keys(cache.frontHistory).filter((key) => {
                return cache.frontHistory[key] === diff[0].content.customStatus
            })

            // if value is unique, publish action
            if (foundInCache.length == 0) {
                action = 'customStatus'
            }
        }
        else {
            if (eventData.content.customStatus == '')
                return 'customStatus'
            console.error('::SimplyWS:: Unrecognized diff: ' + JSON.stringify(diff))
        }
    }
    else {
        // if there's an endTime, it was a removal event
        if (eventData.content.endTime && !eventData.content.live) {
            action = 'remove'
        }
    }

    return action
}

async function swapFront() {
    let system = new System(Config)
    let front = await system.getFronters()
    
    // start forming new front list
    let newFront = []
    let frontNames = []
    for (member of front) {
        let m = await system.getMemberById(member.content.member)

        if (m.content.pkId) {
            // fronting member pkID has been found
            newFront.push(m.content.pkId)
            frontNames.push(m.content.name)
        }
    }

    // shift primary fronter to first in list
    let primary = await findPrimary()
    let primaryPK = primary.pkId
    let primaryName = primary.name
    if (primaryPK) {
        if (newFront.indexOf(primaryPK) > 0) {
            newFront.splice(newFront.indexOf(primaryPK), 1)
            newFront.unshift(primaryPK)
        }

        if (frontNames.indexOf(primaryName) > 0) {
            frontNames.splice(frontNames.indexOf(primaryName), 1)
            frontNames.unshift(primaryName)
        }
    }

    // post the new switch        
    let url = `${pkUrl}/systems/@me/switches`
    await axios.post(url, JSON.stringify({ "members": newFront }), {
        headers: pkHeader
    })
        .then(async (res) => {
            // check if current front equals the new front
            let front = await getPKFronters()
            var equal = (front.length == newFront.length) && front.every(function(element, index) {
                return element === newFront[index]; 
            })
            if (!equal) {
                console.log('::SimplyWS:: Failed to swap front: ' + newFront)
                await swapFront()
                return
            } else {
                let formattedNames = frontNames.toString().replace(',',', ')
                console.log(`::SimplyWS:: SimplyPlural -> PluralKit: ${formattedNames}`)
            }
        })
        .catch(async err => {
            let status = err.status || err.toJSON().status
            if (status == 400) {
                // if the fronter is already in the front, do nothing
                return
            }
            else if (status == 404) {
                return
            }
            else if (status == 429) {
                // Too many requests
                console.warn("::SimplyWS:: Too many requests, waiting to try again.")
                setTimeout(async function () {
                    await swapFront()
                }, 1000)
                return
            }
        })
}

async function insertFront(member) {
    // get current fronters and add new fronter
    let fronters = await getPKFronters()
    if (!fronters.includes(member.content.pkId)) {
        fronters.push(member.content.pkId)
    } else {
        console.warn('::SimplyWS:: Member already in fronters: ' + member.content.pkId)
        return
    }

    // find the "primary" fronter to move to the first element in the list
    let primary = await findPrimary().pkId
    if (primary) {
        if (fronters.indexOf(primary) > 0) {
            fronters.splice(fronters.indexOf(primary), 1)
            fronters.unshift(primary)
        }
    }

    // post the new switch        
    let url = `${pkUrl}/systems/@me/switches`
    await axios.post(url, JSON.stringify({ "members": fronters }), {
        headers: pkHeader
    })
        .then(async (res) => {
            let front = await getPKFronters()
            if (!front.includes(member.content.pkId)) {
                console.log('::SimplyWS:: Failed to insert fronter: ' + member.content.pkId)
                await insertFront(member)
                return
            } else {
                console.log('::SimplyWS:: ' + member.content.name + ' was added to the front.')
            }
        })
        .catch(async err => {
            let status = err.status || err.toJSON().status
            if (status == 400) {
                // if the fronter is already in the front, do nothing
                return
            }
            else if (status == 404) {
                // member not found
                console.error("::SimplyWS:: Could not find member: " + member.content.pkId)
                let index = fronters.indexOf(member.content.pkId)
                fronters.splice(index, 1)
                return
            }
            else if (status == 429) {
                // Too many requests
                console.warn("::SimplyWS:: Too many requests, waiting to try again.")
                let index = fronters.indexOf(member.content.pkId)
                fronters.splice(index, 1)
                setTimeout(async function () {
                    await insertFront(member)
                }, 1000)
                return
            }
        })
}

async function removeFront(member) {
    let fronters = await getPKFronters()
    
    if (fronters.includes(member.content.pkId)) {
        let index = fronters.indexOf(member.content.pkId)
        fronters.splice(index, 1)
    } else {
        console.warn('::SimplyWS:: Member is not in front: ' + member.content.pkId)
        return
    }

    // find the "primary" fronter to move to the first element in the list
    let primary = await findPrimary().pkId
    if (primary) {
        if (fronters.indexOf(primary) > 0) {
            fronters.splice(fronters.indexOf(primary), 1)
            fronters.unshift(primary)
        }
    }

    let url = `${pkUrl}/systems/@me/switches`
    await axios.post(url, JSON.stringify({ "members": fronters }), {
        headers: pkHeader
    })
        .then(async (res) => {
            let front = await getPKFronters()
            if (front.includes(member.content.pkId)) {
                console.log('::SimplyWS:: Failed to remove fronter: ' + member.content.pkId)
                await removeFront(member)
                return
            } else {
                console.log('::SimplyWS:: ' + member.content.name + ' was removed from the front.')
            }
        })
        .catch(async err => {        
            let status = err.status || err.toJSON().status    
            if (status == 400) {
                // fronter is already not in front
                console.warn("::SimplyWS:: " + member.content.name + " is not in the front.")
                return
            }
            else if (status == 429) {
                // Too many requests
                console.warn("::SimplyWS:: Too many requests, waiting to try again.")
                fronters.push(member.content.pkId)
                setTimeout(async function () {
                    await removeFront(member)
                }, 1000)
                return
            }
        })
}

async function updateCustomStatus(member) {
    // find the "primary" fronter to move to the first element in the list
    let fronters = await getPKFronters()
    let primary = await findPrimary().pkId
    if (primary && fronters.length > 1 && (member.content.pkId == primary)) {
        if (fronters.indexOf(primary) >= 0) {
            fronters.splice(fronters.indexOf(primary), 1)
            fronters.unshift(primary)

            // post the new switch
            axios.post(`${pkUrl}/systems/@me/switches`, JSON.stringify({ "members": fronters }), {
                headers: pkHeader
            })
                .catch(async err => {
                    if (err.toJSON().status == 429)
                        //Too many requests
                        console.warn("::SimplyWS:: Too many requests, waiting to try again.")
                        setTimeout(function () {
                            updateCustomStatus(member)
                        }, 1000)
                        return
                })

            console.log('::SimplyWS:: ' + member.content.name + ' is now the primary fronter.')
        }
    }
    else {
        console.log('::SimplyWS:: ' + member.content.name + ' changed custom status.')
    }
}

const transform = require('lodash.transform')
const isEqual = require('lodash.isequal')
const isObject = require('lodash.isobject')
async function calculateDiff(origObj, newObj) {
    return new Promise(function (resolve) {
        changes = (newObj, origObj) => {
            let arrayIndexCounter = 0
            return transform(newObj, function (result, value, key) {
                if (!isEqual(value, origObj[key])) {
                    let resultKey = Array.isArray(origObj) ? arrayIndexCounter++ : key
                    result[resultKey] = (isObject(value) && isObject(origObj[key])) ? changes(value, origObj[key]) : value
                }
            })
        }
        resolve(changes(newObj, origObj))
    })
}

module.exports = {
    initializeCache,
    unknownTarget,
    unrecognizedMessage,
    getPKFronters,
    findPrimary,
    determineAction,
    swapFront,
    insertFront,
    removeFront,
    updateCustomStatus,
    calculateDiff 
}