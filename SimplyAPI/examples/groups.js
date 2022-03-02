const config = require('./config.json')
const SAPI = require('./SimplyAPI.js')
const SimplyAPI = new SAPI(config)

let group = {
    parent: "root",
    color: "",
    private: true,
    preventTrusted: false,
    name: "123",
    desc: "test group",
    emoji: "",
    members: []
}

main = async () => {
    getGroups()
    findGroup("123")
    createTestGroup(group)
    deleteTestGroup("123")
}

getGroups = async () => {
    SimplyAPI.getGroups()
        .then((response) => {
            console.log(response.data)
        })
        .catch(err => console.error(err))
}

findGroup = async (what) => {
    SimplyAPI.findGroup(what, (group) => {
        if (group) {
            console.log(group)
        }
    })
}

createTestGroup = async (data) => {
    SimplyAPI.createGroup(data)
        .then((response) => {
            console.log(response.data)
        })
        .catch(err => console.error(err))
}

deleteTestGroup = async (what) => {
    await SimplyAPI.findGroup(what, async (group) => {
        if (group) {
            await SimplyAPI.deleteGroup(group.id)
                .then(async (res) => {
                    if (res.status == 200) {
                        console.log(`group deleted: ${group.content.name}.`,)
                    }
                })
                .catch(err => console.error(err))
        }
    })
}

main()