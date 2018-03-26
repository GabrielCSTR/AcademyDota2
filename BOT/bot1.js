var steam = require("steam"),
    util = require("util"),
    fs = require("fs"),
    crypto = require("crypto"),
    dota2 = require("../"),
    steamClient = new steam.SteamClient(),
    steamUser = new steam.SteamUser(steamClient),
    steamFriends = new steam.SteamFriends(steamClient),
    Dota2 = new dota2.Dota2Client(steamClient, true);	
	var mysql = require('mysql');

	//Dados conexão MySQL
	var db_config = {
		host: 'localhost',
		user: 'root',
		password: '23051991',
		database: 'dota'
	};

	// variaveis
	var id;
	var botid = 1;
	var log4js = require('log4js-extension');

	// Logs
	log4js.loadAppender('file');	
	log4js.addAppender(log4js.appenders.file('../logs/log.log'), 'result');	
	log4js.addAppender(log4js.appenders.file('../logs/bots/bot'+botid+'.log'), 'BOT #'+botid);	
	log4js.addAppender(log4js.appenders.file('../logs/bots/chat_bot'+botid+'.log'), 'CHATBOT #'+botid);

	var logger = log4js.getLogger('result');
	var blog = log4js.getLogger('BOT #'+botid);
	var chat = log4js.getLogger('CHATBOT #'+botid);

	// handles sidconnect mysql
	function handleDisconnect() {
		connection = mysql.createConnection(db_config);
		connection.connect(function(err) {
			if(err) {
			setTimeout(handleDisconnect, 2000); 
			}                                     
		});                                    
		connection.on('error', function(err) {
			if(err.code === 'PROTOCOL_CONNECTION_LOST') { 
			handleDisconnect();                         
			} else {                                     
			throw err;                                  
			}
		});
	}

	handleDisconnect();

// faz conexão mysql  e 
// Separa player informados por times
//
var t1,t2,gamemode,pass;
global.config = require("./configs/config" + botid);
connection.connect(function(err){
	var users = [];	
	var lobbygame;	
	var ready = 0;
	var sql = 'SELECT * FROM ladder_bots WHERE bot_id = '+ botid +' LIMIT 1';
	connection.query(sql, function(err, results, fields) {
		if(results.length != 0)
		{
			lobbygame = results[0].bot_game;			
		}
		if(!err)
		{
				var sql = 'SELECT * FROM ladder_lobbies_games LEFT JOIN ladder_lobbies ON ladder_lobbies_games.lobby_g_lobby=ladder_lobbies.lobby_id WHERE lobby_g_id = '+ lobbygame + ' LIMIT 1';
				connection.query(sql, function(err, results, fields) {
					if (err) throw err;	
						  console.log(results[0].lobby_g_team1);
						  
					t1 = results[0].lobby_g_team1;
					t2 = results[0].lobby_g_team2;
					gamemode = results[0].lobby_g_gamemod;
					var t1p = results[0].lobby_g_players1.split(',');
					var t2p = results[0].lobby_g_players2.split(',');
					var players = t1p.concat(t2p);
					
					players.forEach(function(item, i, arr) {
						users[i] = item;			
					});
					ready = 1;
				
			});	
		}
	});	

function freebot()
{
	connection.query("UPDATE ladder_bots SET bot_busy=0 WHERE bot_id = " + botid);
}

// Função criarLobby
function createLobby()
{

	/*Configurar o lobby*/
	pass = Math.floor((Math.random() * 99999) + 1);
	pass = pass+'_'+ lobbygame;
	 var options = {
		"game_name": "Jogo #"+lobbygame,
		"server_region": 10,
		"game_mode": gamemode,
		"game_version": 1,
		"allow_cheats": false,
		"fill_with_bots": false,
		"allow_spectating": true,
		"pass_key": pass,
		"radiant_series_wins": 0,
		"dire_series_wins": 0,
		"allchat": false
	}
	/*Fim da configuração*/	

	Dota2.createPracticeLobby(options, function(err, data){	
		if (err) {
			util.log(err + ' - ' + JSON.stringify(data));
		}
		if(JSON.stringify(data['result']) == 1){
			util.log("Lobby criado com sucesso");
			logger.info("Lobby criado com sucesso lobby №"+lobbygame);
			steamFriends.sendMessage('76561198032447477', 'Foi criando um novo lobby №'+lobbygame, steam.EChatEntryType.ChatMsg);
		}else{
			util.log("Crie um lobby não excluído");
		}
	});

	Dota2.joinPracticeLobbyTeam(1, 4, function(err, data){
		if(JSON.stringify(data['result']) == 1)
		{
			util.log("Bot tomou o lugar de observador.");
		}
	});
	/*Invites*/
	setInterval(function(){
		if(ready == 1){			
			users.forEach(function(item, i, arr) {
				Dota2.inviteToLobby(item);
			});
			ready = 0;
		}
	},5000);
}

var onSteamLogOn = function onSteamLogOn(logonResp) {

    if (logonResp.eresult == steam.EResult.OK) {		
        steamFriends.setPersonaState(steam.EPersonaState.Busy);
        steamFriends.setPersonaName("DotaAcademy|BOT #" + botid);
        util.log("Autorizado.");
        Dota2.launch();
        Dota2.on("ready", function() {
			var date = new Date();
			blog.info('Bot iniciado com sucesso! '+date);
            util.log("Bot №" + botid + " está pronto.");			
           /*Создаем лобби*/
		   createLobby();
		   /*Лобии создано*/
		Dota2.on('practiceLobbyUpdate', function(lobby) {						
		id = lobby.lobby_id + "";
		var status = lobby.match_outcome;	
		var chat = 0;
			if(chat == 0)
			{
				Dota2.joinChat('Lobby_'+id, 3);
			}
			if(status != 0)
			{
				connection.query("UPDATE ladder_lobbies_games SET lobby_g_result= "+ status + " WHERE lobby_g_id = " + lobbygame);
				switch(status){
					case 1://Победа тьмы
						connection.query("UPDATE ladder_lobbies_games SET lobby_g_winner= "+ t1 + " WHERE lobby_g_id = " + lobbygame);
						break
					case 2://Победа света
						connection.query("UPDATE ladder_lobbies_games SET lobby_g_winner= "+ t2 + " WHERE lobby_g_id = " + lobbygame);
						break
				}				
				connection.query("UPDATE ladder_bots SET bot_busy=0 WHERE bot_id = " + botid);
			}
			var pn;
			var pnn = 0;
			lobby['members'].forEach(function(item, i, arr) {
				pn = i+1;
			});
			if(pn == 3)
			{
				var laucnh = 0;
				if(launch = 0)
				{
					Dota2.sendMessage('Lobby_'+id, 'O jogo começará em 5 segundos!.');
					setTimeout(function(){
						Dota2.launchPracticeLobby(function(err, data){});
						laucnh = 1;
						steamFriends.sendMessage('76561198032447477', 'Jogo #' + id + ' foi iniciado!', steam.EChatEntryType.ChatMsg);
					}, 5000);
				}
			}
		
		});	
            // ----------------------------------
        });

		Dota2.on("practiceLobbyUpdate", function (lobby){
			id = lobby.lobby_id + "";
			setTimeout(function(){				
				Dota2.sendMessage("Olá player!!", 'Lobby_'+id , 3);
			}, 1000);	
		});
		
        Dota2.on("unready", function onUnready() {
            util.log("Node-dota2 unready.");
        });

        Dota2.on("chatMessage", function(channel, personaName, message) {
			chat.trace("[" + channel + "] " + personaName + ": " + message);
        });

        Dota2.on("unhandled", function(kMsg) {
            util.log("UNHANDLED MESSAGE #" + kMsg);
        });
    }
},
	onSteamServers = function onSteamServers(servers) {
		util.log("Received servers.");
		fs.writeFile('servers', JSON.stringify(servers));
	},
	onSteamLogOff = function onSteamLogOff(eresult) {
		util.log("Logged off from Steam.");
	},
	onSteamError = function onSteamError(error) {
		util.log("Connection closed by server.");
	};
steamFriends.on('message', function(source, message, type, chatter) {
  // respond to both chat room and private messages
  
	if(message.length <= 0){
		console.log(source + ' Escrevendo...');
	}
	else{
		console.log(source +' Mensagem recebida: ' + message);
	}
  
    
  switch(message)
  {
  	case 'ExitLobby':
	  	Dota2.abandonCurrentGame();
		Dota2.leavePracticeLobby();
		Dota2.leaveChat('Lobby_'+id);
	    steamFriends.sendMessage(source, 'Saiu do lobby #'+id, steam.EChatEntryType.ChatMsg);
		blog.info('Usuário '+source+' mandou sair do lobby #'+id);
		id = null;
		break
	case 'Status':
	  if(id != null)
	  {
		var answer = 'Eu estou no lobby #'+id+'. Senha do lobby: '+pass;
		steamFriends.sendMessage(source, answer, steam.EChatEntryType.ChatMsg);
		blog.info('Usuário '+source+' solicitou o status do jogo e recebeu uma resposta: "'+answer+'"');
	  }
	  else
	  {
		steamFriends.sendMessage(source, 'Estou esperando pelo jogo.', steam.EChatEntryType.ChatMsg);   
	  }
	  break
	case 'CriarLobby':
		createLobby();
		blog.info('Usuário '+source+' solicitou a criação de um novo jogo');
		break
	case 'InviteAdmin':
		Dota2.inviteToLobby("76561198032447477");
		steamFriends.sendMessage(source, 'Convite para administradores foi enviado! ' + source, steam.EChatEntryType.ChatMsg); 
		blog.info('Usuário '+source+' convidou a administração no lobby');
		break
	case 'OffBot':
		Dota2.abandonCurrentGame();
		Dota2.leavePracticeLobby();
		Dota2.leaveChat('Lobby_'+id);
		Dota2.exit();
		steamClient.disconnect();
		connection.query("UPDATE ladder_bots SET bot_busy=0 WHERE bot_id = " + botid);
		blog.info('Usuário '+source+' Desligou o bot');
		break
	case 'StartGame':
		Dota2.launchPracticeLobby(function(err, data){});
		var answer = 'Jogo #' + id + ' foi iniciado!';
		steamFriends.sendMessage(source, answer, steam.EChatEntryType.ChatMsg);
		blog.info('Usuário '+source+' solicitou o início do jogo e recebeu uma resposta "'+answer+'"');	
		break
	case 'kick':
		var answer = 'O jogador foi kickado!';
		Dota2.practiceLobbyKickFromTeam(Dota2.ToAccountID('76561198032447477'));
 		steamFriends.sendMessage(source, answer, steam.EChatEntryType.ChatMsg);
		break
  }  
});

steamUser.on('updateMachineAuth', function(sentry, callback) {
    var hashedSentry = crypto.createHash('sha1').update(sentry.bytes).digest();
    fs.writeFileSync('sentry', hashedSentry)
    util.log("sentryfile saved");

    callback({ sha_file: hashedSentry});
});

var logOnDetails = {
    "account_name": global.config.steam_user,
    "password": global.config.steam_pass,
};

if (global.config.steam_guard_code) logOnDetails.auth_code = global.config.steam_guard_code;
if (global.config.two_factor_code) logOnDetails.two_factor_code = global.config.two_factor_code;

try {
    var sentry = fs.readFileSync('sentry');
    if (sentry.length) logOnDetails.sha_sentryfile = sentry;
}
catch (beef){
    util.log("Cannot load the sentry. " + beef);
}

steamClient.connect();

steamClient.on('connected', function() {
    steamUser.logOn(logOnDetails);
});

steamClient.on('logOnResponse', onSteamLogOn);
steamClient.on('loggedOff', onSteamLogOff);
steamClient.on('error', onSteamError);
steamClient.on('servers', onSteamServers);
});
