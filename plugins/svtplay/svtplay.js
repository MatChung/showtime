/**
 * SVT play plugin using xml.svtplay.se API
 *
 * The hardcoded URLs has been extracted from 
 *     http://svtplay.se/mobil/deviceconfiguration.xml
 *
 */

(function(plugin) {

  plugin.settings = plugin.createSettings("SVT Play", "video");

  plugin.settings.createInfo("info",
			     plugin.config.path + "svtplay.png",
			     "Sveriges Television online");

  plugin.settings.createBool("enabled", "Enable SVT Play", false, function(v) {

    plugin.config.enabled = v;
    if(v) {
      plugin.service = showtime.createService("SVT Play",
					      "svtplay:start", "tv");
    } else {
      delete plugin.service;
    }
  });





  var opensearch = new Namespace("http://a9.com/-/spec/opensearch/1.1/");
  var svtplay    = new Namespace("http://xml.svtplay.se/ns/playrss");
  var media      = new Namespace("http://search.yahoo.com/mrss");

  // Loop over an item and return the best (highest bitrate) available media
  function bestMedia(item) {
    var bestItem;
    for each (var m in item.media::group.media::content) {

      if(m.@type == 'application/vnd.apple.mpegurl')
	continue;
      if(showtime.canHandle(m.@url)) {
	if(!bestItem || m.@bitrate > bestItem.@bitrate) {
	  bestItem = m;
	}
      }
    }
    return bestItem;
  }



  function pageController(page, loader, populator) {
    var offset = 1;

    function paginator() {

      var num = 0;

      while(1) {
	var doc = new XML(loader(offset + num));
	page.entries = doc.channel.opensearch::totalResults;
	var c = 0;

	for each (var item in doc.channel.item) {
	  c++;
	  populator(page, item);
	}
	page.loading = false;
	num += c;
	if(c == 0 || num > 50)
	  break;
      }
      offset += num;

    }

    page.type = "directory";
    paginator();
    page.paginator = paginator;
  }

  function titlePopulator(page, item) {
    page.appendItem("svtplay:video:" + item.svtplay::titleId,
		    "directory", {
		      title: item.title});
  };



  plugin.addURI("svtplay:title:([0-9,]*)", function(page, id) {
    pageController(page, function(offset) {
      return showtime.httpGet("http://xml.svtplay.se/v1/title/list/" + id, {
	start: offset
      });
    }, titlePopulator);
  });



  plugin.addURI("svtplay:video:([0-9,]*)", function(page, id) {
    pageController(page, function(offset) {
      return showtime.httpGet("http://xml.svtplay.se/v1/video/list/" + id, {
	start: offset
      });
    }, function(page, item) {

      var metadata = {
	title: item.svtplay::titleName.toString() + " - " + item.title
      };
      
      var best = bestMedia(item);
      
      if(best === undefined)
	return;

      metadata.icon = item.media::thumbnail.@url;
      metadata.description = item.description;

      var duration =  parseInt(best.@duration);

      if(duration > 0)
	metadata.duration = duration;

      page.appendItem(best.@url,
		      "video", metadata);
    });
  });

  plugin.addURI("svtplay:start", function(page) {

    var svtplay = new Namespace("http://xml.svtplay.se/ns/playopml");

    var doc = new XML(showtime.httpGet("http://svtplay.se/mobil/deviceconfiguration.xml"));

    for each (var o in doc.body.outline) {

      if(o.@text == "Kategorier") {
	for each (var k in o.outline) {

	  var id = k.@svtplay::contentNodeIds;

	  page.appendItem("svtplay:title:" + id,
			  "directory", {
			    title: k.@text,
			    icon: k.@svtplay::thumbnail
			  });
	}
      }
    }
    page.title = "SVT Play";
    page.type = "directory";
    page.loading = false;

  });
  

  plugin.addSearcher(
    "SVT Play", plugin.config.path + "svtplay_icon.png",
    function(page, query) {
      
      pageController(page, function(offset) {
	return showtime.httpGet("http://xml.svtplay.se/v1/title/search/96238", {
	  start: offset,
	  q: query
	});
      }, titlePopulator);
    });


})(this);
