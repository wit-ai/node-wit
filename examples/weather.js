var request = require('request')

module.exports = function (token) {
	return new Weather(token)
}

function Weather (token) {
	var self = this
	self.token = token

	self.get = function (location, date, fn) {
		var url = 'http://api.openweathermap.org/data/2.5/forecast?q=' + location + 
				'&list.dt=' + date + '&units=metric&APPID=' + self.token
		console.log('weather api: ' + url);

		request({url: url, json: true}, function (error, response, data) {
			if (error) {
				return fn(error)
			}
			if (response.statusCode !== 200) {
				return fn(new Error('unexpected status ' + response.statusCode))
			}

			var currentConditions = data.list[0].weather[0].description
			var currentTemp = Math.round(data.list[0].main.temp * 1.8 + 32) + 'F'
			var msg = currentTemp + ' and ' + currentConditions
			fn(null, msg)
		})
	}
}