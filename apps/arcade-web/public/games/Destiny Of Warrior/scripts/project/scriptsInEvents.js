"use strict";

function getDateTime() {
        var now     = new Date(); 
        var month   = now.getMonth()+1; 
        var day     = now.getDate();
        var hour    = now.getHours();
        var minute  = now.getMinutes();
        var second  = now.getSeconds(); 
        if(month.toString().length == 1) {
             month = '0'+month;
        }
        if(day.toString().length == 1) {
             day = '0'+day;
        }   
        if(hour.toString().length == 1) {
             hour = '0'+hour;
        }
        if(minute.toString().length == 1) {
             minute = '0'+minute;
        }
        if(second.toString().length == 1) {
             second = '0'+second;
        }   
        var dateTime = hour+':'+minute+':'+second+'|'+ month+'/'+day;
         return dateTime;
    }

{
	const scriptsInEvents = {

		async History_Event9_Act1(runtime, localVars)
		{
			localVars.gettime = getDateTime();
		}

	};
	
	self.C3.ScriptsInEvents = scriptsInEvents;
}
