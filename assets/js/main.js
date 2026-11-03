/* Sydney Tree Connect: navigation and enquiry form.
   The form also works without JavaScript (plain POST to the same endpoint). */
(function () {
  "use strict";

  // Mobile navigation
  var toggle = document.querySelector(".nav-toggle");
  var nav = document.getElementById("site-nav");
  if (toggle && nav) {
    toggle.addEventListener("click", function () {
      var open = toggle.getAttribute("aria-expanded") === "true";
      toggle.setAttribute("aria-expanded", String(!open));
      nav.classList.toggle("is-open", !open);
    });
    nav.addEventListener("click", function (e) {
      if (e.target.closest("a")) {
        toggle.setAttribute("aria-expanded", "false");
        nav.classList.remove("is-open");
      }
    });
  }

  var form = document.getElementById("enquiry-form");
  if (!form) return;

  // Keep in step with the limits in api/enquiry.php
  var MAX_PHOTOS = 5;
  var MAX_PHOTO_BYTES = 4 * 1024 * 1024;
  var MAX_TOTAL_BYTES = 12 * 1024 * 1024;
  var RESIZE_OVER_BYTES = 1.5 * 1024 * 1024;
  var RESIZE_MAX_EDGE = 2000;
  var ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
  var ALLOWED_EXT = /\.(jpe?g|png|webp|heic|heif)$/i;
  var REQUEST_TIMEOUT_MS = 90000;

  var summary = document.getElementById("form-summary");
  var status = document.getElementById("form-status");
  var button = document.getElementById("submit-button");
  var photosInput = document.getElementById("photos");
  var photosList = document.getElementById("photos-list");
  var started = document.getElementById("form_started");
  var buttonLabel = button.textContent;
  var submitting = false;

  started.value = String(Date.now());

  var labels = {
    name: "Name",
    email: "Email",
    phone: "Phone",
    contact_method: "Preferred contact method",
    suburb: "Suburb",
    postcode: "Postcode",
    service: "Service required",
    description: "Job description",
    photos: "Tree photos",
    property_authority: "Your connection to the property",
    council_status: "Council approval status",
    consent: "Consent"
  };

  function value(name) {
    var el = form.elements[name];
    if (!el) return "";
    if (typeof el.value === "string") return el.value.trim();
    return "";
  }

  function radioValue(name) {
    var checked = form.querySelector('input[name="' + name + '"]:checked');
    return checked ? checked.value : "";
  }

  function phoneDigits(v) {
    return v.replace(/\D/g, "");
  }

  function validate() {
    var errors = {};
    var name = value("name");
    var email = value("email");
    var phone = value("phone");
    var method = radioValue("contact_method");

    if (!name) errors.name = "Enter your name.";
    else if (name.length > 100) errors.name = "Name must be 100 characters or fewer.";

    if (!email) errors.email = "Enter your email address.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 254)
      errors.email = "Enter a valid email address, like name@example.com.";

    if (phone && (!/^[0-9+()\-\s]{8,20}$/.test(phone) || phoneDigits(phone).length < 8 || phoneDigits(phone).length > 15))
      errors.phone = "Enter a valid phone number, like 0400 000 000.";

    if (method !== "email" && method !== "phone") errors.contact_method = "Choose email or phone.";
    else if (method === "phone" && !phone && !errors.phone)
      errors.phone = "Enter a phone number, or choose email as your preferred contact method.";

    if (!value("suburb")) errors.suburb = "Enter your suburb.";
    if (!value("postcode")) errors.postcode = "Enter your postcode.";
    else if (!/^2\d{3}$/.test(value("postcode"))) errors.postcode = "Enter a 4-digit NSW postcode, like 2000.";

    if (!value("service")) errors.service = "Choose the service you need, or Not sure.";

    var desc = value("description");
    if (!desc) errors.description = "Describe the job.";
    else if (desc.length < 10) errors.description = "Add a little more detail about the job.";
    else if (desc.length > 3000) errors.description = "Job description must be 3000 characters or fewer.";

    var photoError = checkPhotos(photosInput.files);
    if (photoError) errors.photos = photoError;

    if (!radioValue("property_authority")) errors.property_authority = "Choose your connection to the property.";
    if (!radioValue("council_status")) errors.council_status = "Choose a council approval status. Not sure is fine.";
    if (!form.elements.consent.checked) errors.consent = "Tick the box to agree to your enquiry being shared with the contractor.";

    return errors;
  }

  function checkPhotos(files) {
    if (!files || !files.length) return "";
    if (files.length > MAX_PHOTOS) return "You can attach up to " + MAX_PHOTOS + " photos.";
    for (var i = 0; i < files.length; i++) {
      var f = files[i];
      var typeOk = ALLOWED_TYPES.indexOf(f.type) !== -1 || (!f.type && ALLOWED_EXT.test(f.name));
      if (!typeOk || !ALLOWED_EXT.test(f.name)) return f.name + " is not a JPEG, PNG, WebP or HEIC photo.";
      // Big JPEG/PNG/WebP files are resized before upload; HEIC can't be resized in most browsers.
      if (f.size > MAX_PHOTO_BYTES && !canResize(f)) return f.name + " is larger than 4 MB.";
    }
    return "";
  }

  function canResize(f) {
    return /^image\/(jpeg|png|webp)$/.test(f.type) && typeof window.createImageBitmap === "function";
  }

  function fieldTarget(name) {
    if (name === "consent") return document.getElementById("consent");
    var group = document.getElementById(name);
    return group || form.elements[name];
  }

  function clearErrors() {
    form.querySelectorAll("[data-error-for]").forEach(function (p) {
      p.textContent = "";
    });
    form.querySelectorAll('[aria-invalid="true"]').forEach(function (el) {
      el.removeAttribute("aria-invalid");
    });
    document.getElementById("consent-wrap").removeAttribute("data-invalid");
    summary.hidden = true;
    summary.querySelector("ul").innerHTML = "";
  }

  function showErrors(errors) {
    clearErrors();
    var keys = Object.keys(labels).filter(function (k) {
      return errors[k];
    });
    if (!keys.length) return false;
    var list = summary.querySelector("ul");
    keys.forEach(function (k) {
      var p = form.querySelector('[data-error-for="' + k + '"]');
      if (p) p.textContent = errors[k];
      var target = fieldTarget(k);
      if (target && target.setAttribute) target.setAttribute("aria-invalid", "true");
      if (k === "consent") document.getElementById("consent-wrap").setAttribute("data-invalid", "true");
      var li = document.createElement("li");
      var a = document.createElement("a");
      a.href = "#" + focusId(k);
      a.textContent = labels[k] + ": " + errors[k];
      a.addEventListener("click", function (e) {
        e.preventDefault();
        var el = document.getElementById(focusId(k));
        if (el) el.focus();
      });
      li.appendChild(a);
      list.appendChild(li);
    });
    summary.hidden = false;
    summary.focus();
    return true;
  }

  function focusId(k) {
    if (k === "contact_method" || k === "property_authority" || k === "council_status") {
      var first = form.querySelector('input[name="' + k + '"]:checked') || form.querySelector('input[name="' + k + '"]');
      if (first && !first.id) first.id = k + "-first";
      return first ? first.id : k;
    }
    return k;
  }

  // Re-validate a field once the visitor has corrected it
  form.addEventListener("change", function (e) {
    if (!summary.hidden || form.querySelector('[aria-invalid="true"]')) {
      var name = e.target.name === "photos[]" ? "photos" : e.target.name;
      var errors = validate();
      var p = form.querySelector('[data-error-for="' + name + '"]');
      if (p && !errors[name]) {
        p.textContent = "";
        var t = fieldTarget(name);
        if (t && t.removeAttribute) t.removeAttribute("aria-invalid");
        if (name === "consent") document.getElementById("consent-wrap").removeAttribute("data-invalid");
      }
      // Phone preference affects the phone field
      if (name === "contact_method" && !errors.phone) {
        form.querySelector('[data-error-for="phone"]').textContent = "";
        form.elements.phone.removeAttribute("aria-invalid");
      }
    }
  });

  photosInput.addEventListener("change", function () {
    photosList.innerHTML = "";
    var files = photosInput.files;
    for (var i = 0; i < files.length; i++) {
      var li = document.createElement("li");
      li.textContent = files[i].name + " (" + formatSize(files[i].size) + ")";
      photosList.appendChild(li);
    }
    var err = checkPhotos(files);
    var p = form.querySelector('[data-error-for="photos"]');
    p.textContent = err;
    if (err) photosInput.setAttribute("aria-invalid", "true");
    else photosInput.removeAttribute("aria-invalid");
  });

  function formatSize(bytes) {
    return bytes >= 1048576 ? (bytes / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(bytes / 1024)) + " KB";
  }

  // Resize large photos and drop embedded metadata (such as GPS location).
  function preparePhoto(file) {
    if (!canResize(file) || file.size <= RESIZE_OVER_BYTES) return Promise.resolve(file);
    return createImageBitmap(file, { imageOrientation: "from-image" })
      .then(function (bmp) {
        var scale = Math.min(1, RESIZE_MAX_EDGE / Math.max(bmp.width, bmp.height));
        var canvas = document.createElement("canvas");
        canvas.width = Math.round(bmp.width * scale);
        canvas.height = Math.round(bmp.height * scale);
        canvas.getContext("2d").drawImage(bmp, 0, 0, canvas.width, canvas.height);
        if (bmp.close) bmp.close();
        return new Promise(function (resolve) {
          canvas.toBlob(function (blob) {
            if (!blob || blob.size >= file.size) return resolve(file);
            var name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
            resolve(new File([blob], name, { type: "image/jpeg" }));
          }, "image/jpeg", 0.82);
        });
      })
      .catch(function () {
        return file;
      });
  }

  function setBusy(busy, message) {
    submitting = busy;
    button.disabled = busy;
    button.setAttribute("aria-disabled", String(busy));
    if (busy) {
      button.innerHTML = '<span class="spinner" aria-hidden="true"></span><span>Sending…</span>';
    } else {
      button.textContent = buttonLabel;
    }
    status.className = "form-status" + (busy ? " is-busy" : "");
    status.textContent = message || "";
  }

  function showFailure(message) {
    setBusy(false);
    status.className = "form-status is-error";
    status.textContent = message;
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (submitting) return;

    status.textContent = "";
    status.className = "form-status";
    if (showErrors(validate())) return;

    setBusy(true, "Sending your enquiry. Please keep this page open.");

    var files = Array.prototype.slice.call(photosInput.files || []);
    Promise.all(files.map(preparePhoto))
      .then(function (prepared) {
        var total = 0;
        for (var i = 0; i < prepared.length; i++) {
          if (prepared[i].size > MAX_PHOTO_BYTES) throw { field: "photos", message: prepared[i].name + " is still larger than 4 MB. Please choose a smaller photo." };
          total += prepared[i].size;
        }
        if (total > MAX_TOTAL_BYTES) throw { field: "photos", message: "Your photos add up to more than 12 MB. Please remove one or two." };

        var data = new FormData(form);
        data.delete("photos[]");
        prepared.forEach(function (f) {
          data.append("photos[]", f, f.name);
        });

        var controller = typeof AbortController === "function" ? new AbortController() : null;
        var timer = controller ? setTimeout(function () { controller.abort(); }, REQUEST_TIMEOUT_MS) : null;

        return fetch(form.action, {
          method: "POST",
          body: data,
          headers: { Accept: "application/json", "X-Requested-With": "fetch" },
          credentials: "same-origin",
          signal: controller ? controller.signal : undefined
        }).then(function (res) {
          if (timer) clearTimeout(timer);
          return res.text().then(function (text) {
            var json = null;
            try {
              json = JSON.parse(text);
            } catch (err) {
              json = null;
            }
            return { res: res, json: json };
          });
        });
      })
      .then(function (r) {
        // Only an explicit accepted response from the handler counts as success.
        if (r.res.ok && r.json && r.json.ok === true) {
          status.className = "form-status";
          status.textContent = "Enquiry sent. Taking you to the confirmation page.";
          window.location.assign("/thank-you.html");
          return;
        }
        if (r.json && r.json.errors && Object.keys(r.json.errors).length) {
          setBusy(false);
          showErrors(r.json.errors);
          return;
        }
        var msg = r.json && typeof r.json.message === "string" ? r.json.message : "";
        showFailure(
          msg || "Sorry, your enquiry could not be sent right now. Nothing has been submitted. Please try again later."
        );
      })
      .catch(function (err) {
        if (err && err.field) {
          setBusy(false);
          var o = {};
          o[err.field] = err.message;
          showErrors(o);
          return;
        }
        var aborted = err && err.name === "AbortError";
        showFailure(
          aborted
            ? "Sending took too long and was stopped. Your enquiry may not have been received. Please check your connection and try again."
            : "Sorry, we couldn’t reach the enquiry service. Your enquiry has not been sent. Please check your connection and try again."
        );
      });
  });
})();
