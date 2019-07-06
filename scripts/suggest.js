// Description:
//   Allows a chat user to post a suggestion for hubot features or enhancements
//
// Dependencies:
//
//
// Configuration:
//  RELEASE_NOTIFICATION_ROOM - id of flow to use for suggestion posts if robot name not found in TARGET_FLOW_PER_ROBOT
//  FLOWDOCK_ORGANIZATION_NAME - name of flowdock organization for constructing urls
//
// Commands:
//   hubot suggest <your idea here> - Posts a message to the main hubot flow, with content of the suggestion & name of the user, and replies to the command with a link to that flow

const util = require("util")

const {
  getRoomIdFromName,
  getRoomNameFromId,
  getRoomInfoFromIdOrName,
} = require("../lib/flowdock-util")

const FLOW_URL = `https://www.flowdock.com/app/{orgName}/{flowName}`
const THREAD_URL = `https://www.flowdock.com/app/{orgName}/{flowName}/threads/{threadId}`

module.exports = function(robot) {
  robot.respond(/suggest ?((?:.|\s)*)$/i, res => {
    let fallbackErrorMessage = `Please ask your friendly human robot-tender to look into it.`

    if (
      !process.env["RELEASE_NOTIFICATION_ROOM"] ||
      !process.env["FLOWDOCK_ORGANIZATION_NAME"]
    ) {
      robot.logger.error(
        `Missing essential configuration for the suggest command. Check your environment variables for RELEASE_NOTIFICATION_ROOM and FLOWDOCK_ORGANIZATION_NAME.`,
      )
      res.send(
        `Sorry, something isn't set up correctly for this command to work. ${fallbackErrorMessage}`,
      )
      return
    }

    try {
      // TODO: clean this up when we refactor all occurances of RELEASE_NOTIFICATION_ROOM to use name instead of ID
      const targetFlow = getRoomInfoFromIdOrName(
        robot,
        process.env["RELEASE_NOTIFICATION_ROOM"],
      )
      let targetFlowName = ""
      let targetFlowId = ""
      let targetFlowReference = ""

      if (typeof targetFlow == "undefined" || !targetFlow) {
        // this is probably local dev, but let's log an error in case this ever happens in prod
        releaseNotificationRoom = process.env["RELEASE_NOTIFICATION_ROOM"]
        robot.logger.info(
          `Could not get flow data for: ${releaseNotificationRoom}.`,
        )
        // and fall back to a reference to the room name instead of a link
        targetFlowReference = `${releaseNotificationRoom}`
      } else {
        targetFlowName = targetFlow.name
        let targetFlowLink = FLOW_URL.replace(
          /{orgName}/,
          process.env["FLOWDOCK_ORGANIZATION_NAME"].toLowerCase(),
        ).replace(/{flowName}/, targetFlowName.toLowerCase())
        targetFlowReference = `[${targetFlowName}](${targetFlowLink})`

        targetFlowId = targetFlow.id
      }

      let user = res.message.user
      let userSuggestion = res.match[1]

      let redirectToTargetFlowMessage = `You can try again from a public flow, or join us in ${targetFlowReference} and chat with us about your idea there.`

      if (typeof res.message.room === "undefined") {
        return res.send(
          `Sorry, this command only works from flows, not DMs.\n${redirectToTargetFlowMessage}`,
        )
      }

      let flowData = getRoomInfoFromIdOrName(robot, res.message.room)
      if (flowData && flowData.access_mode === "invitation") {
        return res.send(
          `Sorry, this command only works from public flows, to protect the privacy of your invite-only flow.\n\n${redirectToTargetFlowMessage}`,
        )
      }

      if (!userSuggestion) {
        res.send(
          "Yes? I'm listening.... \n(Please try again: this time add your suggestion after the `suggest` command).",
        )
        return
      }

      let sourceFlow = getRoomNameFromId(robot, res.message.room)
      let originalThreadReference = ""

      if (typeof sourceFlow === "undefined" || !sourceFlow) {
        // this is probably local dev, but let's log an error in case this ever happens in prod
        robot.logger.info(
          `Could not get room name from res.message.room: ${res.message.room}.`,
        )
        // and fall back to a reference to the room instead of a link
        sourceFlow = res.message.room
        originalThreadReference = `Refer to original thread in: ${res.message.room}.`
      } else {
        let sourceThreadId = res.message.metadata.thread_id
        let sourceThreadLink = THREAD_URL.replace(
          /{orgName}/,
          process.env["FLOWDOCK_ORGANIZATION_NAME"].toLowerCase(),
        )
          .replace(/{flowName}/, sourceFlow.toLowerCase())
          .replace(/{threadId}/, sourceThreadId)
        originalThreadReference = `See [original thread](${sourceThreadLink}).`
      }

      // post suggestion message & related info
      let formattedSuggestion = `@${res.message.user.name} just made a #suggestion in ${sourceFlow}:\n>${userSuggestion}\n\n${originalThreadReference}`
      let envelope = {
        room: targetFlowId,
      }

      // TODO: get link to this post
      robot.send(envelope, formattedSuggestion)

      // then respond in source suggestion thread
      // TODO: add link to post in TARGET_FLOW
      res.send(
        `Thanks for the suggestion! We'll be discussing it further in ${targetFlowReference}, feel free to join us there.`,
      )
    } catch (err) {
      robot.logger.error(
        `Failed to send user suggestion to target flow: ${util.inspect(err)}`,
      )
      return res.send(
        `Something went wrong trying to post your suggestion. ${fallbackErrorMessage}`,
      )
    }
  })
}
