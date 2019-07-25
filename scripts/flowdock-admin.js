// Description:
//   A collection of utilities to get and set information in hubot's brain,
//   related to flowdock usage.
//
// Configuration:
//   HUBOT_FLOWDOCK_API_TOKEN
//
// Commands:
//   hubot flows - reponds with a list of flows as Flow Name: flow-id
//   hubot reconnect <optional reason for reconnecting> - reconnects to the flowdock stream
//   hubot users [flowdock|robot] - responds with a list of Flowdock users as User Name: user-id
//   hubot user update <user id> <new user name>- updates the user's name in hubot's brain
//
// Author:
//   shadowfiend
//   kb0rg

const { notUsingFlowdock } = require("../lib/flowdock-util"),
  { fetchConfigOrReportIssue } = require("../lib/config"),
  flowdock = require("@reloaddk/flowdock")

module.exports = function(robot) {
  const apiToken = fetchConfigOrReportIssue(robot, "HUBOT_FLOWDOCK_API_TOKEN")

  robot.respond(/flows/, response => {
    if (notUsingFlowdock(robot.adapter, response)) {
      return
    }
    if (robot.adapter.flows != null) {
      response.send(
        robot.adapter.flows
          .map(flow => ` - ${flow.name}: ${flow.id}`)
          .join("\n"),
      )
    } else {
      response.send("No flows have been joined.")
    }
  })

  robot.respond(/users (robot|flowdock)/i, { id: "users" }, response => {
    let dataSource = response.match[1].toLowerCase()
    if (dataSource === "flowdock") {
      if (notUsingFlowdock(robot.adapter, response)) {
        return
      }
      const session = new flowdock.Session(apiToken)
      session.get("/users/", {}, (err, body, usersResponse) => {
        if (err == null) {
          response.send(
            body.map(user => ` - ${user.nick}: ${user.id}`).join("\n"),
          )
        } else {
          robot.logger.error("Flowdock users error: %o", err)
          response.send(
            "Something went wrong trying to get users from Flowdock.",
          )
        }
      })
    }

    if (dataSource === "robot") {
      response.send(
        Object.values(robot.brain.users())
          .map(user => ` - ${user.name}: ${user.id}`)
          .join("\n"),
      )
    }
  })

  robot.respond(
    /user update (\d{1,10}) ((?:.|\s)*)/i,
    { id: "user-update" },
    response => {
      // Flowdock doesn't give specs for length of id
      // We currently see 4-6 digits, but allowing here for greater range of length
      let userId = response.match[1]
      let userNewName = response.match[2]

      let user = robot.brain.users()[userId]
      if (user != null) {
        user.name = userNewName
        robot.brain.set(userId, user)
        robot.brain.save()
        let userUpdated = Object.values(robot.brain.users()).find(user => {
          return user.id == userId
        })
        response.send(
          `Updated user!\nname: ${userUpdated.name}: id:${userUpdated.id}`,
        )
      } else {
        response.send(`User not found.`)
      }
    },
  )

  robot.respond(/reconnect ?((?:.|\s)*)$/i, { id: "reconnect" }, response => {
    if (notUsingFlowdock(robot.adapter, response)) {
      return
    }
    let reason = response.match[1] || ""

    try {
      robot.logger.info(
        `Starting reconnect by request of user: ${response.message.user.name}. ${reason}`,
      )
      robot.adapter.reconnect(`Initiated by flowdock command. ${reason}`)
      response.send("Reconnected")
    } catch (err) {
      robot.logger.error(
        `Attempted reconnect initiated by user ${response.message.user.name} failed : %o`,
        err,
      )
      response.send(
        "Something went wrong trying to reconnect, please check the logs for error.",
      )
    }
  })
}
