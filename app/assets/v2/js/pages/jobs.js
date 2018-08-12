/* eslint-disable no-loop-func */
// helper functions

var sidebar_keys = [
  'employment_type',
  'job_type'
];

var localStorage;

try {
  localStorage = window.localStorage;
} catch (e) {
  localStorage = {};
}

function debounce(func, wait, immediate) {
  var timeout;

  return function() {
    var context = this;
    var args = arguments;
    var later = function() {
      timeout = null;
      if (!immediate)
        func.apply(context, args);
    };
    var callNow = immediate && !timeout;

    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
    if (callNow)
      func.apply(context, args);
  };
}

// sets search information default
var save_sidebar_latest = function() {
  localStorage['order_by'] = $('#sort_option').val();

  for (var i = 0; i < sidebar_keys.length; i++) {
    var key = sidebar_keys[i];

    if (key !== 'tech_stack') {
      localStorage[key] = $('input[name=' + key + ']:checked').val();
    } else {
      localStorage[key] = '';

      $('input[name=' + key + ']:checked').each(function() {
        localStorage[key] += $(this).val() + ',';
      });

      // Removing the start and last comma to avoid empty element when splitting with comma
      localStorage[key] = localStorage[key].replace(/^,|,\s*$/g, '');
    }
  }
};

// saves search information default
var set_sidebar_defaults = function() {

  // Special handling to support adding keywords from url query param
  var q = getParam('q');
  var keywords;

  if (q) {
    keywords = decodeURIComponent(q).replace(/^,|\s|,\s*$/g, '');

    if (localStorage['jobs_keywords']) {
      keywords.split(',').forEach(function(v, k) {
        if (localStorage['jobs_keywords'].indexOf(v) === -1) {
          localStorage['jobs_keywords'] += ',' + v;
        }
      });
    } else {
      localStorage['jobs_keywords'] = keywords;
    }

    window.history.replaceState(history.state, 'Issue Explorer | Gitcoin', '/explorer');
  }

  if (localStorage['order_by']) {
    $('#sort_option').val(localStorage['order_by']);
    $('#sort_option').selectmenu('refresh');
  }

  for (var i = 0; i < sidebar_keys.length; i++) {
    var key = sidebar_keys[i];

    if (localStorage[key]) {
      if (key !== 'tech_stack') {
        $('input[name=' + key + '][value=' + localStorage[key] + ']').prop('checked', true);
      } else {
        localStorage[key].split(',').forEach(function(v, k) {
          $('input[name=' + key + '][value=' + v + ']').prop('checked', true);
        });
      }
    }
  }
};

var set_filter_header = function() {
  var idxStatusEl = $('input[name=idx_status]:checked');
  var filter_status = idxStatusEl.attr('val-ui') ? idxStatusEl.attr('val-ui') : 'All';

  // TODO: See what all filters are to be displayed from designs

  $('#filter').html('All');
};

var toggleAny = function(event) {
  if (!event)
    return;
};

var getFilters = function() {
  var _filters = [];

  for (var i = 0; i < sidebar_keys.length; i++) {
    var key = sidebar_keys[i];

    $.each($('input[name=' + key + ']:checked'), function() {
      if ($(this).attr('val-ui')) {
        _filters.push('<a class="filter-tag ' + key + '"><span>' + $(this).attr('val-ui') + '</span>' +
          '<i class="fa fa-times" onclick="removeFilter(\'' + key + '\', \'' + $(this).attr('value') + '\')"></i></a>');
      }
    });
  }

  if (localStorage['jobs_keywords']) {
    localStorage['jobs_keywords'].split(',').forEach(function(v, k) {
      _filters.push('<a class="filter-tag keywords"><span>' + v + '</span>' +
        '<i class="fa fa-times" onclick="removeFilter(\'jobs_keywords\', \'' + v + '\')"></i></a>');
    });
  }

  $('.filter-tags').html(_filters);
};

var removeFilter = function(key, value) {
  if (key !== 'jobs_keywords') {
    $('input[name=' + key + '][value=' + value + ']').prop('checked', false);
  } else {
    localStorage['jobs_keywords'] = localStorage['jobs_keywords'].replace(value, '').replace(',,', ',');

    // Removing the start and last comma to avoid empty element when splitting with comma
    localStorage['jobs_keywords'] = localStorage['jobs_keywords'].replace(/^,|,\s*$/g, '');
  }

  refreshjobs();
};

var get_search_URI = function() {
  var uri = '/api/v0.1/jobs/?';
  var keywords = '';

  for (var i = 0; i < sidebar_keys.length; i++) {
    var key = sidebar_keys[i];
    var filters = [];

    $.each ($('input[name=' + key + ']:checked'), function() {
      if (key === 'tech_stack' && $(this).val()) {
        keywords += $(this).val() + ', ';
      } else if ($(this).val()) {
        filters.push($(this).val());
      }
    });

    var val = filters.toString();

    if ((key === 'bounty_filter') && val) {
      var values = val.split(',');

      values.forEach(function(_value) {
        var _key;

        if (_value === 'createdByMe') {
          _key = 'bounty_owner_github_username';
          _value = document.contxt.github_handle;
        } else if (_value === 'startedByMe') {
          _key = 'interested_github_username';
          _value = document.contxt.github_handle;
        } else if (_value === 'fulfilledByMe') {
          _key = 'fulfiller_github_username';
          _value = document.contxt.github_handle;
        }

        if (_value !== 'any')
          uri += '&' + _key + '=' + _value;
      });

      // TODO: Check if value myself is needed for coinbase
      if (val === 'fulfilledByMe') {
        key = 'bounty_owner_address';
        val = 'myself';
      }
    }

    if (val !== 'any' &&
        key !== 'bounty_filter' &&
        key !== 'bounty_owner_address') {
      uri += '&' + key + '=' + val;
    }
  }

  if (localStorage['jobs_keywords']) {
    localStorage['jobs_keywords'].split(',').forEach(function(v, k) {
      keywords += v + ', ';
    });
  }

  if (keywords) {
    uri += '&raw_data=' + keywords;
  }

  if (typeof web3 != 'undefined' && web3.eth.coinbase) {
    uri += '&coinbase=' + web3.eth.coinbase;
  } else {
    uri += '&coinbase=unknown';
  }

  var order_by = localStorage['order_by'];

  if (order_by) {
    uri += '&order_by=' + order_by;
  }

  return uri;
};

var process_stats = function(results) {
  var num = results.length;
  var worth_usdt = 0;
  var worth_eth = 0;
  var currencies_to_value = {};

  for (var i = 0; i < results.length; i++) {
    var result = results[i];

    var this_worth_usdt = Number.parseFloat(result['value_in_usdt']);
    var this_worth_eth = Number.parseFloat(result['value_in_eth']);

    if (this_worth_usdt) {
      worth_usdt += this_worth_usdt;
    }
    if (this_worth_eth) {
      worth_eth += this_worth_eth;
    }
    var token = result['token_name'];

    if (token !== 'ETH') {
      if (!currencies_to_value[token]) {
        currencies_to_value[token] = 0;
      }
      currencies_to_value[token] += Number.parseFloat(result['value_true']);
    }
  }

  worth_usdt = worth_usdt.toFixed(2);
  worth_eth = (worth_eth / Math.pow(10, 18)).toFixed(2);
  var stats = worth_usdt + ' USD, ' + worth_eth + ' ETH';

  for (var t in currencies_to_value) {
    if (Object.prototype.hasOwnProperty.call(currencies_to_value, t)) {
      stats += ', ' + currencies_to_value[t].toFixed(2) + ' ' + t;
    }
  }

  var matchesEl = $('#matches');
  var
      listingInfoEl = $('#listing-info');

  switch (num) {
    case 0:
      matchesEl.html(gettext('No Results'));

      listingInfoEl.html('');
      break;
    case 1:
      // matchesEl.html(num + gettext(' Matching Result'));
      //
      listingInfoEl.html("<span id='modifiers'>Funded Issue</span><span id='stats' class='font-body'>(" + stats + ')</span>');

      listingInfoEl.html(num + gettext(' Active Job Listing'));
      break;
    default:
      // matchesEl.html(num + gettext(' Matching Results'));
      //
      listingInfoEl.html("<span id='modifiers'>Funded Issues</span><span id='stats' class='font-body'>(" + stats + ')</span>');
      //
      listingInfoEl.html("<span id='modifiers'>Funded Issues</span><span id='stats' class='font-body'>(" + stats + ')</span>');

      listingInfoEl.html(num + gettext(' Active Job Listings'));
  }
};

var paint_jobs_in_viewport = function(start, max) {
  document.is_painting_now = true;
  var num_jobs = document.jobs_html.length;

  for (var i = start; i < num_jobs && i < max; i++) {
    var html = document.jobs_html[i];

    document.last_bounty_rendered = i;
    $('#jobs').append(html);
  }

  $('div.job-row.result').each(function() {
    var href = $(this).attr('href');

    if (typeof $(this).changeElementType !== 'undefined') {
      $(this).changeElementType('a'); // hack so that users can right click on the element
    }

    $(this).attr('href', href);
  });
  document.is_painting_now = false;

  if (document.referrer.search('/onboard') != -1) {
    $('.job-row').each(function(index) {
      if (index > 2)
        $(this).addClass('hidden');
    });
  }
};

var trigger_scroll = debounce(function() {
  if (typeof document.jobs_html == 'undefined' || document.jobs_html.length == 0) {
    return;
  }
  var scrollPos = $(document).scrollTop();
  var last_active_bounty = $('.job-row.result:last-child');

  if (last_active_bounty.length == 0) {
    return;
  }

  var window_height = $(window).height();
  var have_painted_all_jobs = document.jobs_html.length <= document.last_bounty_rendered;
  var buffer = 500;
  var does_need_to_paint_more = !document.is_painting_now && !have_painted_all_jobs && ((last_active_bounty.offset().top) < (scrollPos + buffer + window_height));

  if (does_need_to_paint_more) {
    paint_jobs_in_viewport(document.last_bounty_rendered + 1, document.last_bounty_rendered + 6);
  }
}, 200);

$(window).scroll(trigger_scroll);
$('body').bind('touchmove', trigger_scroll);

var refreshjobs = function(event) {
  save_sidebar_latest();
  set_filter_header();
  toggleAny(event);
  getFilters();

  $('.nonefound').css('display', 'none');
  $('.loading').css('display', 'block');
  $('.job-row').remove();

  // filter
  var uri = get_search_URI();

  // analytics
  var params = { uri: uri };

  mixpanel.track('Refresh jobs', params);

  // order
  $.get(uri, function(results) {
    results = sanitizeAPIResults(results);

    if (results.length === 0) {
      $('.nonefound').css('display', 'block');
    }

    document.is_painting_now = false;
    document.last_bounty_rendered = 0;
    document.jobs_html = [];

    for (var i = 0; i < results.length; i++) {
      // setup
      var result = results[i];
      var related_token_details = tokenAddressToDetails(result['token_address']);
      var decimals = 18;

      if (related_token_details && related_token_details.decimals) {
        decimals = related_token_details.decimals;
      }

      var divisor = Math.pow(10, decimals);

      result['rounded_amount'] = Math.round(result['value_in_token'] / divisor * 100) / 100;
      var is_expired = new Date(result['expires_date']) < new Date() && !result['is_open'];

      result.action = result['url'];
      result['title'] = result['title'] ? result['title'] : result['github_url'];

      var timeLeft = timeDifference(new Date(result['expiry_date']), new Date(), true);

      result['job_company'] = ((result['company'] ? result['company'] : 'Company Hidden') + ' &bull; ');

      result['job_skill'] = result['skills'] ? result['skills'] : '';

      result['watch'] = 'Watch';

      // render the template
      var tmpl = $.templates('#result');
      var html = tmpl.render(result);

      document.jobs_html[i] = html;
    }

    paint_jobs_in_viewport(0, 10);

    process_stats(results);
  }).fail(function() {
    _alert({message: 'got an error. please try again, or contact support@gitcoin.co'}, 'error');
  }).always(function() {
    $('.loading').css('display', 'none');
  });
};

window.addEventListener('load', function() {
  set_sidebar_defaults();
  refreshjobs();
});

var getNextDayOfWeek = function(date, dayOfWeek) {
  var resultDate = new Date(date.getTime());

  resultDate.setDate(date.getDate() + (7 + dayOfWeek - date.getDay() - 1) % 7 + 1);
  return resultDate;
};

function getURLParams(k) {
  var p = {};

  location.search.replace(/[?&]+([^=&]+)=([^&]*)/gi, function(s, k, v) {
    p[k] = v;
  });
  return k ? p[k] : p;
}

var resetFilters = function() {
  for (var i = 0; i < sidebar_keys.length; i++) {
    var key = sidebar_keys[i];
    var tag = ($('input[name=' + key + '][value]'));
  }
};

(function() {
  if (document.referrer.search('/onboard') != -1) {
    $('#sidebar_container').addClass('invisible');
    $('#dashboard-title').addClass('hidden');
    $('#onboard-dashboard').removeClass('hidden');
    resetFilters();
    $('input[name=idx_status][value=open]').prop('checked', true);
    $('.search-area input[type=text]').text(getURLParams('q'));
    document.referrer = '';

    $('#onboard-alert').click(function(e) {
      $('.job-row').each(function(index) {
        $(this).removeClass('hidden');
      });
      $('#onboard-dashboard').addClass('hidden');
      $('#sidebar_container').removeClass('invisible');
      $('#dashboard-title').removeClass('hidden');
      e.preventDefault();
    });
  } else {
    $('#onboard-dashboard').addClass('hidden');
    $('#sidebar_container').removeClass('invisible');
    $('#dashboard-title').removeClass('hidden');
  }
})();

$(document).ready(function() {

  // Sort select menu
  $('#sort_option').selectmenu({
    select: function(event, ui) {
      refreshjobs();
      event.preventDefault();
    }
  });

  // TODO: DRY
  function split(val) {
    return val.split(/,\s*/);
  }

  function extractLast(term) {
    return split(term).pop();
  }

  // Handle search input clear
  $('.close-icon')
    .on('click', function(e) {
      e.preventDefault();
      $('#keywords').val('');
      $(this).hide();
    });

  $('#keywords')
    .on('input', function() {
      if ($(this).val()) {
        $('.close-icon').show();
      } else {
        $('.close-icon').hide();
      }
    })
    // don't navigate away from the field on tab when selecting an item
    .on('keydown', function(event) {
      if (event.keyCode === $.ui.keyCode.TAB && $(this).autocomplete('instance').menu.active) {
        event.preventDefault();
      }
    })
    .autocomplete({
      minLength: 0,
      source: function(request, response) {
        // delegate back to autocomplete, but extract the last term
        response($.ui.autocomplete.filter(document.keywords, extractLast(request.term)));
      },
      focus: function() {
        // prevent value inserted on focus
        return false;
      },
      select: function(event, ui) {
        var terms = split(this.value);
        var isTechStack = false;

        $('.close-icon').hide();

        // remove the current input
        terms.pop();

        // add the selected item
        terms.push(ui.item.value);

        // add placeholder to get the comma-and-space at the end
        terms.push('');

        // this.value = terms.join(', ');
        this.value = '';

        if (!isTechStack) {
          if (localStorage['jobs_keywords']) {
            localStorage['jobs_keywords'] += ',' + ui.item.value;
          } else {
            localStorage['jobs_keywords'] += ui.item.value;
          }

          $('.filter-tags').append('<a class="filter-tag keywords"><span>' + ui.item.value + '</span>' +
            '<i class="fa fa-times" onclick="removeFilter(\'jobs_keywords\', \'' + ui.item.value + '\')"></i></a>');
        }

        return false;
      }
    });

  // sidebar clear
  $('.dashboard #clear').click(function(e) {
    e.preventDefault();

    for (var i = 0; i < sidebar_keys.length; i++) {
      var key = sidebar_keys[i];
      var tag = ($('input[name=' + key + '][value]'));

      for (var j = 0; j < tag.length; j++) {
        if (tag[j].value === 'any')
          $('input[name=' + key + '][value=any]').prop('checked', true);
        else
          $('input[name=' + key + '][value=' + tag[j].value + ']').prop('checked', false);
      }
    }

    refreshjobs();
  });

  // search bar
  $('#jobs').delegate('#new_search', 'click', function(e) {
    refreshjobs();
    e.preventDefault();
  });

  $('.search-area input[type=text]').keypress(function(e) {
    if (e.which == 13) {
      refreshjobs();
      e.preventDefault();
    }
  });

  // sidebar filters
  $('.sidebar_search input[type=radio], .sidebar_search label').change(function(e) {
    refreshjobs();
    e.preventDefault();
  });

  // sidebar filters
  $('.sidebar_search input[type=checkbox], .sidebar_search label').change(function(e) {
    refreshjobs(e);
    e.preventDefault();
  });

  // email subscribe functionality
  $('.save_search').click(function(e) {
    e.preventDefault();
    $('#save').remove();
    var url = '/sync/search_save';

    setTimeout(function() {
      $.get(url, function(newHTML) {
        $(newHTML).appendTo('body').modal();
        $('#save').append("<input type='hidden' name='raw_data' value='" + get_search_URI() + "'>");
        $('#save_email').focus();
      });
    }, 300);
  });

  var emailSubscribe = function() {
    var email = $('#save input[type=email]').val();
    var raw_data = $('#save input[type=hidden]').val();
    var is_validated = validateEmail(email);

    if (!is_validated) {
      _alert({ message: gettext('Please enter a valid email address.') }, 'warning');
    } else {
      var url = '/sync/search_save';

      $.post(url, {
        email: email,
        raw_data: raw_data
      }, function(response) {
        var status = response['status'];

        if (status == 200) {
          _alert({message: gettext("You're in! Keep an eye on your inbox for the next funding listing.")}, 'success');
          $.modal.close();
        } else {
          _alert({message: response['msg']}, 'error');
        }
      });
    }
  };

  $('body').delegate('#save input[type=email]', 'keypress', function(e) {
    if (e.which == 13) {
      emailSubscribe();
      e.preventDefault();
    }
  });
  $('body').delegate('#save a', 'click', function(e) {
    emailSubscribe();
    e.preventDefault();
  });
});
