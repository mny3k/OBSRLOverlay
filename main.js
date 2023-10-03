let url = document.currentScript.src
//let filePath = url.slice(8).slice(0, -7)
let filePath = "D:/VsCodeProjects/RLOverlay/OBSRLOverlay/"


console.log(filePath);

const obs = new OBSWebSocket();

//Connect to WS
try {
    const {
      obsWebSocketVersion,
      negotiatedRpcVersion
    } = obs.connect('ws://127.0.0.1:4455', 'obswsserver', {
      rpcVersion: 1
    });
    $(".OBSws").text(`Connected to OBS server ${obsWebSocketVersion} (using RPC ${negotiatedRpcVersion})`);
    console.log(`Connected to OBS server ${obsWebSocketVersion} (using RPC ${negotiatedRpcVersion})`)
} catch (error) {
    $(".OBSws").text('Failed to connect to OBS', error.code, error.message);
    console.error('Failed to connect to OBS', error.code, error.message);
}

//Code for SOS plugin, DO NOT TOUCH
const WsSubscribers = {
    __subscribers: {},
    websocket: undefined,
    webSocketConnected: false,
    registerQueue: [],
    init: function(port, debug, debugFilters) {
        port = port || 49322;
        debug = debug || false;
        if (debug) {
            if (debugFilters !== undefined) {
                console.warn("WebSocket Debug Mode enabled with filtering. Only events not in the filter list will be dumped");
            } else {
                console.warn("WebSocket Debug Mode enabled without filters applied. All events will be dumped to console");
                console.warn("To use filters, pass in an array of 'channel:event' strings to the second parameter of the init function");
            }
        }
        WsSubscribers.webSocket = new WebSocket("ws://localhost:" + port);
        WsSubscribers.webSocket.onmessage = function (event) {
            let jEvent = JSON.parse(event.data);
            if (!jEvent.hasOwnProperty('event')) {
                return;
            }
            let eventSplit = jEvent.event.split(':');
            let channel = eventSplit[0];
            let event_event = eventSplit[1];
            if (debug) {
                if (!debugFilters) {
                    console.log(channel, event_event, jEvent);
                } else if (debugFilters && debugFilters.indexOf(jEvent.event) < 0) {
                    console.log(channel, event_event, jEvent);
                }
            }
            WsSubscribers.triggerSubscribers(channel, event_event, jEvent.data);
        };
        WsSubscribers.webSocket.onopen = function () {
            $(".RLws").text(`Connected to RL SOS server on port ${port}`);
            WsSubscribers.triggerSubscribers("ws", "open");
            WsSubscribers.webSocketConnected = true;
            WsSubscribers.registerQueue.forEach((r) => {
                WsSubscribers.send("wsRelay", "register", r);
            });
            WsSubscribers.registerQueue = [];
        };
        WsSubscribers.webSocket.onerror = function () {
            $(".RLws").text(`Failed to connect to RL SOS Server`);
            WsSubscribers.triggerSubscribers("ws", "error");
            WsSubscribers.webSocketConnected = false;
        };
        WsSubscribers.webSocket.onclose = function () {
            WsSubscribers.triggerSubscribers("ws", "close");
            WsSubscribers.webSocketConnected = false;
        };
    },
    /**
     * Add callbacks for when certain events are thrown
     * Execution is guaranteed to be in First In First Out order
     * @param channels
     * @param events
     * @param callback
     */
    subscribe: function(channels, events, callback) {
        if (typeof channels === "string") {
            let channel = channels;
            channels = [];
            channels.push(channel);
        }
        if (typeof events === "string") {
            let event = events;
            events = [];
            events.push(event);
        }
        channels.forEach(function(c) {
            events.forEach(function (e) {
                if (!WsSubscribers.__subscribers.hasOwnProperty(c)) {
                    WsSubscribers.__subscribers[c] = {};
                }
                if (!WsSubscribers.__subscribers[c].hasOwnProperty(e)) {
                    WsSubscribers.__subscribers[c][e] = [];
                    if (WsSubscribers.webSocketConnected) {
                        WsSubscribers.send("wsRelay", "register", `${c}:${e}`);
                    } else {
                        WsSubscribers.registerQueue.push(`${c}:${e}`);
                    }
                }
                WsSubscribers.__subscribers[c][e].push(callback);
            });
        })
    },
    clearEventCallbacks: function (channel, event) {
        if (WsSubscribers.__subscribers.hasOwnProperty(channel) && WsSubscribers.__subscribers[channel].hasOwnProperty(event)) {
            WsSubscribers.__subscribers[channel] = {};
        }
    },
    triggerSubscribers: function (channel, event, data) {
        if (WsSubscribers.__subscribers.hasOwnProperty(channel) && WsSubscribers.__subscribers[channel].hasOwnProperty(event)) {
            WsSubscribers.__subscribers[channel][event].forEach(function(callback) {
                if (callback instanceof Function) {
                    callback(data);
                }
            });
        }
    },
    send: function (channel, event, data) {
        if (typeof channel !== 'string') {
            console.error("Channel must be a string");
            return;
        }
        if (typeof event !== 'string') {
            console.error("Event must be a string");
            return;
        }
        if (channel === 'local') {
            this.triggerSubscribers(channel, event, data);
        } else {
            let cEvent = channel + ":" + event;
            WsSubscribers.webSocket.send(JSON.stringify({
                'event': cEvent,
                'data': data
            }));
        }
    }
};

let players = ["Chipper", "Centice", "Sundown", "Goose", "Slider", "Stinger"]

WsSubscribers.init(49122, true);

let teams = [null,null];
let songs = ["BustItOut.mp3", "Castaway.mp3", "Color.mp3", "Contra.mp3", "Gold.mp3", "HeatWave.mp3", "MoveOn.mp3", "NewWorld.mp3", "Runnin.mp3", "Skyforth.mp3", "Weapon.mp3"]

let team1
let team2
let titleText
let teamScores = [0,0]
let playerData
let scoreTextLeft
let scoreTextRight
let gametime
let bestOf

$("#Save").click(function (e){
    e.preventDefault();
    team1 = $('#team1List :selected').val();
    team2 = $('#team2List :selected').val();
    titleText = $('#Title').val();
    teamScores = [$('#Score1').val(), $('#Score2').val()]

    for (let i = 0; i < 4; i++) {
        setItemVisibility(`BlueTicker${i+1}`, "TickersNS", false)
        setItemVisibility(`OrangeTicker${i+1}`, "TickersNS", false)
    }

    updateTickers(teamScores[0], teamScores[1])

    //console.log(teamScores);

    bestOf = $('#bestOf :selected').val();

    //console.log(bestOf);

    obs.call("SetInputSettings", {
        inputName: 'TickerBG',
        inputSettings: {
            file: `${filePath}graphics/BO${bestOf}TickerBG.png`
        }
    })

    players = [$('#Player1Name').val(), $('#Player2Name').val(), $('#Player3Name').val(), $('#Player4Name').val(), $('#Player5Name').val(), $('#Player6Name').val()]

    //console.log(players);

    obs.call("SetInputSettings", {
        inputName: 'GameTitle',
        inputSettings: {
            text: titleText
        }
    })
    
    obs.call("SetInputSettings", {
        inputName: 'Team1Name',
        inputSettings: {
            text: team1
        }
    })

    obs.call("SetInputSettings", {
        inputName: 'Team2Name',
        inputSettings: {
            text: team2
        }
    })

    obs.call("SetInputSettings", {
        inputName: 'Player1Start',
        inputSettings: {
            text: players[0]
        }
    })

    obs.call("SetInputSettings", {
        inputName: 'Player2Start',
        inputSettings: {
            text: players[1]
        }
    })

    obs.call("SetInputSettings", {
        inputName: 'Player3Start',
        inputSettings: {
            text: players[2]
        }
    })

    obs.call("SetInputSettings", {
        inputName: 'Player4Start',
        inputSettings: {
            text: players[3]
        }
    })

    obs.call("SetInputSettings", {
        inputName: 'Player5Start',
        inputSettings: {
            text: players[4]
        }
    })

    obs.call("SetInputSettings", {
        inputName: 'Player6Start',
        inputSettings: {
            text: players[5]
        }
    })

    obs.call("SetInputSettings", {
        inputName: 'Team1Logo',
        inputSettings: {
            file: `${filePath}graphics/TeamLogos/${team1}.png`
        }
    })

    obs.call("SetInputSettings", {
        inputName: 'Team2Logo',
        inputSettings: {
            file: `${filePath}graphics/TeamLogos/${team2}.png`
        }
    })

    //Can loop through players instead of set indiviually to increase performance
    obs.call("SetInputSettings", {
        inputName: 'Player1',
        inputSettings: {
            url: $('#Player1Cam').val()
        }
    })

    obs.call("SetInputSettings", {
        inputName: 'Player2',
        inputSettings: {
            url: $('#Player2Cam').val()
        }
    })

    obs.call("SetInputSettings", {
        inputName: 'Player3',
        inputSettings: {
            url: $('#Player3Cam').val()
        }
    })

    obs.call("SetInputSettings", {
        inputName: 'Player4',
        inputSettings: {
            url: $('#Player4Cam').val()
        }
    })

    obs.call("SetInputSettings", {
        inputName: 'Player5',
        inputSettings: {
            url: $('#Player5Cam').val()
        }
    })

    obs.call("SetInputSettings", {
        inputName: 'Player6',
        inputSettings: {
            url: $('#Player6Cam').val()
        }
    })
});

WsSubscribers.subscribe("game", "update_state", async (state) =>{

    let Timer1 = new Date(state['game']['time_seconds'] * 1000).toISOString().slice(14, 19);
    let Timer2 = Timer1.replace(/^0(?:0:0?)?/, '');
    let Timer;

    gametime = state['game']['time_seconds'];

    playerData = (state['players'])

    if (state['game']['isOT'] === true) {
        Timer = Timer2.padStart(Timer2.length + 1, "+")
    } else {
        Timer = Timer2
    }

    await obs.call("SetInputSettings", {
        inputName: 'Timer',
        inputSettings: {
            text: Timer
        }
    })

    //teams = [state['game']['teams'][0].name.toLowerCase().charAt(0).toUpperCase() + state['game']['teams'][0].name.toLowerCase().slice(1), state['game']['teams'][1].name.toLowerCase().charAt(0).toUpperCase() + state['game']['teams'][1].name.toLowerCase().slice(1)];
    teams = [team1,team2];

    scoreTextLeft = state['game']['teams'][0]['score'].toString();
    await obs.call("SetInputSettings", {
        inputName: 'Score1',
        inputSettings: {
            text: scoreTextLeft
        }
    })

    scoreTextRight = state['game']['teams'][1]['score'].toString();
    await obs.call("SetInputSettings", {
        inputName: 'Score2',
        inputSettings: {
            text: scoreTextRight
        }
    })

    let targetPlayerFull = state['game']['target'].toString();
    let targetPlayer = targetPlayerFull.substring(0, targetPlayerFull.length - 2);

    if (state['game']['time_seconds'] < 31 && state['game']['isOT'] === false) {
        setItemVisibility("BlueCamsNS", "Game", true)
        setItemVisibility("OrangeCamsNS", "Game", true)
    }

    let test = await obs.call ("GetSceneItemList", {
        sceneName: "TargetPlayerNS"
    })

    console.log(test);

    //If Rocket League has a Target Player
    if (state['game']['hasTarget'] === true && state['game']['hasWinner'] === false) {

        let targetPlayerScore = state['players'][targetPlayerFull]['score'].toString();
        let targetPlayerGoals = state['players'][targetPlayerFull]['goals'].toString();
        let targetPlayerShots = state['players'][targetPlayerFull]['shots'].toString();
        let targetPlayerAssists = state['players'][targetPlayerFull]['assists'].toString();
        let targetPlayerSaves = state['players'][targetPlayerFull]['saves'].toString();
        let targetPlayerDemos = state['players'][targetPlayerFull]['demos'].toString();
        let targetPlayerBoost = state['players'][targetPlayerFull]['boost'].toString();
        let targetPlayerTeam = state['players'][targetPlayerFull]['team']

        await updateTargetPlayerInfo(targetPlayer, targetPlayerScore, targetPlayerGoals, targetPlayerShots, targetPlayerAssists, targetPlayerSaves, targetPlayerDemos, targetPlayerBoost)
        
        await updateBoost(targetPlayerBoost)

        await setItemVisibility("TargetPlayerNS", "Game", true)
    
        if (targetPlayerTeam === 0) {
            await setItemVisibility("TargetPlayerBlue", "TargetPlayerNS", true)
            await setItemVisibility("TargetPlayerOrange", "TargetPlayerNS", false)
            await setItemVisibility("BlueTargetBoost", "TargetPlayerNS", true)
            await setItemVisibility("OrangeTargetBoost", "TargetPlayerNS", false)
            await setItemVisibility("BlueTargetBoostBG", "TargetPlayerNS", true)
            await setItemVisibility("OrangeTargetBoostBG", "TargetPlayerNS", false)
            await setItemVisibility("BoostBlueNS", "Game", true)
            await setItemVisibility("BoostOrangeNS", "Game", false)
            await setItemVisibility("BlueCamBG", "Cams", true)
            await setItemVisibility("OrangeCamBG", "Cams", false)
        } else {
            await setItemVisibility("TargetPlayerOrange", "TargetPlayerNS", true)
            await setItemVisibility("TargetPlayerBlue", "TargetPlayerNS", false)
            await setItemVisibility("OrangeTargetBoost", "TargetPlayerNS", true)
            await setItemVisibility("BlueTargetBoost", "TargetPlayerNS", false)
            await setItemVisibility("BlueTargetBoostBG", "TargetPlayerNS", false)
            await setItemVisibility("OrangeTargetBoostBG", "TargetPlayerNS", true)
            await setItemVisibility("BoostBlueNS", "Game", false)
            await setItemVisibility("BoostOrangeNS", "Game", true)
            await setItemVisibility("BlueCamBG", "Cams", false)
            await setItemVisibility("OrangeCamBG", "Cams", true)
            
        }

        for (let i = 1; i < 7; i++) {
            if (i != (players.indexOf(targetPlayer) + 1)){
                await obs.call("SetSceneItemEnabled", {
                    sceneName: 'Cams',
                    sceneItemId: i,
                    sceneItemEnabled: false
                })
            } else {
                await obs.call("SetSceneItemEnabled", {
                    sceneName: 'Cams',
                    sceneItemId: players.indexOf(targetPlayer) + 1,
                    sceneItemEnabled: true
                })
            } 
        }

    } else {
        await setItemVisibility("TargetPlayerNS", "Game", false)
        await setItemVisibility("BoostBlueNS", "Game", false)
        await setItemVisibility("BoostOrangeNS", "Game", false)
    } 
})

WsSubscribers.subscribe("game", "match_ended", async (endState) =>{

    endscreenData(Object.values(playerData), scoreTextLeft, scoreTextRight)
    
    console.log(playerData);

    teamScores[endState['winner_team_num']]++;
    $("#Score1").val(teamScores[0]);
    $("#Score2").val(teamScores[1]);

    updateTickers(teamScores[0], teamScores[1])

    let songChoice = Math.floor(Math.random() * 11)

    console.log(songChoice);

    await obs.call("SetInputSettings", {
        inputName: 'EndSong',
        inputSettings: {
            local_file: `${filePath}music/${songs[songChoice]}`
        }
    })

    await obs.call("SetInputSettings", {
        inputName: 'VictoryScreenVid',
        inputSettings: {
            local_file: `${filePath}VictoryScreens/${teams[endState['winner_team_num']]} Victory Screen.mp4`
        }
    })

    obs.call("SetCurrentProgramScene", {
        sceneName: 'VictoryScreen'
    })

    setTimeout(() => { obs.call("SetCurrentProgramScene", {
        sceneName: 'End'
    })}, 10000);
})

WsSubscribers.subscribe("game", "match_created", async (startState) =>{
    await obs.call("SetCurrentProgramScene", {
        sceneName: 'Start'
    })
})

WsSubscribers.subscribe("game", "pre_countdown_begin", async (gamestartState) =>{
    await obs.call("SetCurrentProgramScene", {
        sceneName: 'Game'
    })
})

WsSubscribers.subscribe("game", "match_destroyed", async (destroyedState) =>{
    setItemVisibility("BlueCamsNS", "Game", false)
    setItemVisibility("OrangeCamsNS", "Game", false)
})

WsSubscribers.subscribe("game", "replay_start", async (replayState) =>{
    await obs.call("SetCurrentProgramScene", {
        sceneName: 'Replay'
    })
})

WsSubscribers.subscribe("game", "round_started_go", async (roundState) =>{
    if (gametime > 31) {
        setItemVisibility("BlueCamsNS", "Game", false)
        setItemVisibility("OrangeCamsNS", "Game", false)
    }
})

WsSubscribers.subscribe("game", "goal_scored", async (goalState) =>{

    setItemVisibility("BlueCamsNS", "Game", true)
    setItemVisibility("OrangeCamsNS", "Game", true)

    let scorer = goalState['scorer']['name'];
    let assister = goalState['assister']['name'];
    
    await obs.call("SetInputSettings", {
        inputName: 'Scorer',
        inputSettings: {
            text: scorer
        }
    })

    if (goalState['scorer']['teamnum'] === 0) {
        await setItemVisibility("ReplayBlue", "Replay", true)
        await setItemVisibility("ReplayOrange", "Replay", false)
    } else {
        await setItemVisibility("ReplayBlue", "Replay", false)
        await setItemVisibility("ReplayOrange", "Replay", true)
    }

    if (assister === "") { 
        await setItemVisibility("ReplayAssisterBlue", "Replay", false)
        await setItemVisibility("ReplayAssisterOrange", "Replay", false)
    } else {
        if (goalState['scorer']['teamnum'] === 0) {
            await setItemVisibility("ReplayAssisterBlue", "Replay", true)
            await setItemVisibility("ReplayAssisterOrange", "Replay", false)
        } else {
            await setItemVisibility("ReplayAssisterBlue", "Replay", false)
            await setItemVisibility("ReplayAssisterOrange", "Replay", true)
        }
    }
    await obs.call("SetInputSettings", {
        inputName: 'Assister',
        inputSettings: {
            text: assister
        }
    })

})

WsSubscribers.subscribe("game", "statfeed_event", async (statState) =>{
    setItemVisibility("Demolish", "StatfeedNS", false)
    setItemVisibility("Save", "StatfeedNS", false)
    setItemVisibility("Shot", "StatfeedNS", false)
    setItemVisibility("HatTrick", "StatfeedNS", false)
    setItemVisibility("Goal", "StatfeedNS", false)
    setItemVisibility("EpicSave", "StatfeedNS", false)
    setItemVisibility("Assist", "StatfeedNS", false)

    if ((statState['event_name']) === "Demolish") {
        obs.call("SetInputSettings", {
            inputName: 'StatfeedText',
            inputSettings: {
                text: statState['secondary_target']['name']
            }
        })

        if ((statState['secondary_target']['team_num']) === 0) {
            setItemVisibility("StatBlue", "StatfeedNS", true)
            setItemVisibility("StatOrange", "StatfeedNS", false)
        } else {
            setItemVisibility("StatBlue", "StatfeedNS", false)
            setItemVisibility("StatOrange", "StatfeedNS", true)
        }
    } else {
        obs.call("SetInputSettings", {
            inputName: 'StatfeedText',
            inputSettings: {
                text: statState['main_target']['name']
            }
        })

        if ((statState['main_target']['team_num']) === 0) {
            setItemVisibility("StatBlue", "StatfeedNS", true)
            setItemVisibility("StatOrange", "StatfeedNS", false)
        } else {
            setItemVisibility("StatBlue", "StatfeedNS", false)
            setItemVisibility("StatOrange", "StatfeedNS", true)
        }
    }

    setItemVisibility(statState['event_name'], "StatfeedNS", true)
    setItemVisibility("StatfeedNS", "Game", true)

    await setTimeout(() => { 

        setItemVisibility("StatfeedNS", "Game", false)

    }, 2500);
})

function updateTargetPlayerInfo(Name, Score, Goals, Shots, Assists, Saves, Demos, Boost) {
    //Can create an array with data arranged from left to right, then loop through to set all settings with less code
    obs.call("SetInputSettings", {
        inputName: 'Player',
        inputSettings: {
            text: Name
        }
    })

    obs.call("SetInputSettings", {
        inputName: 'Score',
        inputSettings: {
            text: Score
        }
    })

    obs.call("SetInputSettings", {
        inputName: 'Goals',
        inputSettings: {
            text: Goals
        }
    })

    obs.call("SetInputSettings", {
        inputName: 'Shots',
        inputSettings: {
            text: Shots
        }
    })

    obs.call("SetInputSettings", {
        inputName: 'Assists',
        inputSettings: {
            text: Assists
        }
    })

    obs.call("SetInputSettings", {
        inputName: 'Saves',
        inputSettings: {
            text: Saves
        }
    })

    obs.call("SetInputSettings", {
        inputName: 'Demos',
        inputSettings: {
            text: Demos
        }
    })

    obs.call("SetInputSettings", {
        inputName: 'Boost',
        inputSettings: {
            text: Boost
        }
    })
}

function endscreenData(Players, score1, score2) {

    obs.call("SetInputSettings", {
        inputName: 'EndScore1',
        inputSettings: {
            text: score1
        }
    })

    obs.call("SetInputSettings", {
        inputName: 'EndScore2',
        inputSettings: {
            text: score2
        }
    })

    let parsedPlayers = Players.sort((a,b) => a.team - b.team)

    console.log(parsedPlayers);

    for (let i = 0; i < 6; i++) {
        obs.call("SetInputSettings", {
            inputName: `Player${i + 1}Name`,
            inputSettings: {
                text: parsedPlayers[i]['name']
            }
        })

        obs.call("SetInputSettings", {
            inputName: `Player${i + 1}Goals`,
            inputSettings: {
                text: parsedPlayers[i]['goals'].toString()
            }
        })

        obs.call("SetInputSettings", {
            inputName: `Player${i + 1}Assists`,
            inputSettings: {
                text: parsedPlayers[i]['assists'].toString()
            }
        })

        obs.call("SetInputSettings", {
            inputName: `Player${i + 1}Saves`,
            inputSettings: {
                text: parsedPlayers[i]['saves'].toString()
            }
        })

        obs.call("SetInputSettings", {
            inputName: `Player${i + 1}Shots`,
            inputSettings: {
                text: parsedPlayers[i]['shots'].toString()
            }
        })

        obs.call("SetInputSettings", {
            inputName: `Player${i + 1}Demos`,
            inputSettings: {
                text: parsedPlayers[i]['demos'].toString()
            }
        })

        console.log(parsedPlayers[i]['demos'].toString());
    }
}

function updateBoost(PlayerBoost) {

    setInputCrop("OrangeTargetBoost", "TargetPlayerNS", 1014, 0, (1918 - (PlayerBoost * 19.18)), 0)
    setInputCrop("BlueTargetBoost", "TargetPlayerNS", 1014, 0, (1918 - (PlayerBoost * 19.18)), 0)

    //Blue
    setInputRotation("BoostSliceBlue1", "BoostBlueNS", limitNumberWithinRange(PlayerBoost * 3.15, -1, 45))

    setInputRotation("BoostSliceBlue2", "BoostBlueNS", limitNumberWithinRange(PlayerBoost * 3.15, -1, 90))

    setInputRotation("BoostSliceBlue3", "BoostBlueNS", limitNumberWithinRange(PlayerBoost * 3.15, -1, 135))

    setInputRotation("BoostSliceBlue4", "BoostBlueNS", limitNumberWithinRange(PlayerBoost * 3.15, -1, 180))

    setInputRotation("BoostSliceBlue5", "BoostBlueNS", limitNumberWithinRange(PlayerBoost * 3.15, -1, 225))

    setInputRotation("BoostSliceBlue6", "BoostBlueNS", limitNumberWithinRange(PlayerBoost * 3.15, -1, 270))

    setInputRotation("BoostSliceBlue7", "BoostBlueNS", PlayerBoost * 3.15)

    //Orange
    setInputRotation("BoostSliceOrange1", "BoostOrangeNS", limitNumberWithinRange(PlayerBoost * 3.15, -1, 45))

    setInputRotation("BoostSliceOrange2", "BoostOrangeNS", limitNumberWithinRange(PlayerBoost * 3.15, -1, 90))

    setInputRotation("BoostSliceOrange3", "BoostOrangeNS", limitNumberWithinRange(PlayerBoost * 3.15, -1, 135))

    setInputRotation("BoostSliceOrange4", "BoostOrangeNS", limitNumberWithinRange(PlayerBoost * 3.15, -1, 180))

    setInputRotation("BoostSliceOrange5", "BoostOrangeNS", limitNumberWithinRange(PlayerBoost * 3.15, -1, 225))

    setInputRotation("BoostSliceOrange6", "BoostOrangeNS", limitNumberWithinRange(PlayerBoost * 3.15, -1, 270))

    setInputRotation("BoostSliceOrange7", "BoostOrangeNS", PlayerBoost * 3.15)

}

async function setItemVisibility(Name, Scene, Visible) {

    let inputList = await obs.call("GetSceneItemList", {
        sceneName: Scene
    })

    let selectedItem = inputList.sceneItems[0].sceneItemId;

    for (let i = 0; inputList.sceneItems[i].sourceName != Name; i++) {
        selectedItem = inputList.sceneItems[i + 1].sceneItemId
    }

    await obs.call("SetSceneItemEnabled", {
        sceneName: Scene,
        sceneItemId: selectedItem,
        sceneItemEnabled: Visible
    })

    return 1;
}

async function setInputRotation(Name, Scene, Angle) {

    let inputList = await obs.call("GetSceneItemList", {
        sceneName: Scene
    })

    let selectedItem = inputList.sceneItems[0].sceneItemId;

    for (let i = 0; inputList.sceneItems[i].sourceName != Name; i++) {
        selectedItem = inputList.sceneItems[i + 1].sceneItemId
    }

    obs.call("SetSceneItemTransform", {
        sceneName: Scene,
        sceneItemId: selectedItem,
        sceneItemTransform: {
            rotation: Angle
        }
    })
}

async function setInputCrop(Name, Scene, CropBottom, CropLeft, CropRight, CropTop) {
    let inputList = await obs.call("GetSceneItemList", {
        sceneName: Scene
    })

    let selectedItem = inputList.sceneItems[0].sceneItemId;

    for (let i = 0; inputList.sceneItems[i].sourceName != Name; i++) {
        selectedItem = inputList.sceneItems[i + 1].sceneItemId
    }

    obs.call("SetSceneItemTransform", {
        sceneName: Scene,
        sceneItemId: selectedItem,
        sceneItemTransform: {
            cropBottom: CropBottom,
            cropLeft : CropLeft,
            cropRight : CropRight,
            cropTop : CropTop
        }
    })
}

function updateTickers (score1, score2) {
    console.log(score1, score2);
    for (let i = 0; i < score1; i++) {
        setItemVisibility(`BlueTicker${i+1}`, "TickersNS", true)
    }

    for (let i = 0; i < score2; i++) {
        setItemVisibility(`OrangeTicker${i+1}`, "TickersNS", true)
    }
}

function limitNumberWithinRange(num, min, max){
    const MIN = min || 1;
    const MAX = max || 20;
    const parsed = parseInt(num)
    return Math.min(Math.max(parsed, MIN), MAX)
}

  