const config = require('./config.json')
const SAPI = require('./SimplyAPI.js')
const SimplyAPI = new SAPI(config)

main = async () => {
    getSystem()
    getCurrentFronters()
}

getSystem = async () => {
    SimplyAPI.getSystem()
        .then((response) => {
            console.log(response.data)
        })
        .catch(err => console.error(err))
}

getCurrentFronters = async () => {
    SimplyAPI.getFronters()
        .then((response) => {
            console.log(response)
        })
        .catch(err => console.error(err))
}

main()