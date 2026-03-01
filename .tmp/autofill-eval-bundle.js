"use strict";
(() => {
  // src/content/autofill/dom-utils.ts
  var NATIVE_FIELD_SELECTOR = "input:not([type='hidden']), textarea, select";
  var ARIA_FIELD_SELECTOR = [
    "[role='textbox']",
    "[role='combobox']",
    "[role='listbox']",
    "[role='spinbutton']",
    "[role='checkbox']",
    "[role='radio']",
    "[role='slider']"
  ].join(",");
  var CONTENT_EDITABLE_SELECTOR = "[contenteditable]:not([contenteditable='false'])";
  var DISCOVERABLE_FIELD_SELECTOR = [
    NATIVE_FIELD_SELECTOR,
    ARIA_FIELD_SELECTOR,
    CONTENT_EDITABLE_SELECTOR
  ].join(",");
  var hasHiddenStyle = (style) => style.display === "none" || style.visibility === "hidden" || style.visibility === "collapse";
  var isAriaHidden = (element) => element.getAttribute("aria-hidden")?.toLowerCase() === "true";
  var isElementVisible = (element) => {
    if (!element.isConnected) {
      return false;
    }
    let current = element;
    let elementStyle = null;
    while (current) {
      if (current.hidden || current.hasAttribute("inert") || isAriaHidden(current)) {
        return false;
      }
      const computedStyle = window.getComputedStyle(current);
      if (elementStyle === null) {
        elementStyle = computedStyle;
      }
      if (hasHiddenStyle(computedStyle)) {
        return false;
      }
      current = current.parentElement;
    }
    if (!elementStyle) {
      return false;
    }
    if (element.getClientRects().length === 0 && elementStyle.position !== "fixed") {
      return false;
    }
    return true;
  };

  // src/content/autofill/types.ts
  var SignalType = /* @__PURE__ */ ((SignalType2) => {
    SignalType2["LabelFor"] = "label_for";
    SignalType2["LabelWrap"] = "label_wrap";
    SignalType2["AriaLabelledBy"] = "aria_labelledby";
    SignalType2["Autocomplete"] = "autocomplete";
    SignalType2["AriaLabel"] = "aria_label";
    SignalType2["Name"] = "name";
    SignalType2["Id"] = "id";
    SignalType2["Placeholder"] = "placeholder";
    return SignalType2;
  })(SignalType || {});
  var FIELD_TYPES = [
    "first_name" /* FirstName */,
    "last_name" /* LastName */,
    "full_name" /* FullName */,
    "email" /* Email */,
    "phone" /* Phone */,
    "address_line1" /* AddressLine1 */,
    "address_line2" /* AddressLine2 */,
    "city" /* City */,
    "state" /* State */,
    "postal_code" /* PostalCode */,
    "country" /* Country */,
    "gender" /* Gender */,
    "company" /* Company */,
    "job_title" /* JobTitle */,
    "total_experience" /* TotalExperience */,
    "relevant_experience" /* RelevantExperience */,
    "skills" /* Skills */,
    "tech_stack" /* TechStack */,
    "scale_experience" /* ScaleExperience */,
    "professional_summary" /* ProfessionalSummary */,
    "project_summary" /* ProjectSummary */,
    "highest_education" /* HighestEducation */,
    "graduation_year" /* GraduationYear */,
    "date_of_birth" /* DateOfBirth */,
    "current_ctc" /* CurrentCtc */,
    "expected_ctc" /* ExpectedCtc */,
    "notice_period" /* NoticePeriod */,
    "resume" /* Resume */,
    "linkedin" /* LinkedIn */,
    "github" /* GitHub */,
    "leetcode" /* LeetCode */,
    "website" /* Website */,
    "unknown" /* Unknown */
  ];

  // src/content/autofill/layer1/field-discovery.ts
  var ACTION_INPUT_TYPES = /* @__PURE__ */ new Set(["submit", "reset", "button", "image"]);
  var BOOLEAN_INPUT_TYPES = /* @__PURE__ */ new Set(["checkbox", "radio"]);
  var CHOICE_INPUT_TYPES = /* @__PURE__ */ new Set([
    "date",
    "datetime-local",
    "month",
    "week",
    "time",
    "range",
    "color"
  ]);
  var ASHBY_AUTOFILL_CLASS_FRAGMENT = "ashby-application-form-autofill";
  var CAPTCHA_HINT_TERMS = [
    "captcha",
    "recaptcha",
    "hcaptcha",
    "g-recaptcha-response",
    "security code",
    "verification code"
  ];
  var LEGAL_CONSENT_HINT_TERMS = [
    "consent",
    "terms",
    "privacy",
    "policy",
    "gdpr",
    "acknowledge",
    "candidateconsent"
  ];
  var isNativeFieldElement = (element) => element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement || element instanceof HTMLElement;
  var isActionControl = (element) => {
    if (element instanceof HTMLInputElement) {
      return ACTION_INPUT_TYPES.has(element.type.toLowerCase());
    }
    return false;
  };
  var isDisabledOrReadonly = (element) => {
    const isLikelyDatepickerReadonlyInput = (inputElement) => {
      if (!inputElement.readOnly) {
        return false;
      }
      const context = [
        inputElement.name,
        inputElement.id,
        inputElement.className,
        inputElement.getAttribute("aria-label") ?? "",
        inputElement.getAttribute("placeholder") ?? ""
      ].join(" ").toLowerCase();
      return context.includes("date") || context.includes("dob") || context.includes("birth") || context.includes("datepicker");
    };
    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
      if (element.disabled) {
        return true;
      }
      if (element instanceof HTMLInputElement && isLikelyDatepickerReadonlyInput(element)) {
        return false;
      }
      if (element.readOnly) {
        return true;
      }
    }
    if (element instanceof HTMLSelectElement && element.disabled) {
      return true;
    }
    if (!(element instanceof HTMLElement)) {
      return false;
    }
    const ariaDisabled = element.getAttribute("aria-disabled");
    const ariaReadonly = element.getAttribute("aria-readonly");
    return ariaDisabled === "true" || ariaReadonly === "true";
  };
  var getRole = (element) => element instanceof HTMLElement ? element.getAttribute("role")?.toLowerCase() ?? "" : "";
  var classifyControlKind = (element) => {
    if (element instanceof HTMLInputElement) {
      const inputType = element.type.toLowerCase();
      const role2 = element.getAttribute("role")?.toLowerCase() ?? "";
      if (BOOLEAN_INPUT_TYPES.has(inputType)) {
        return "boolean" /* Boolean */;
      }
      if (inputType === "file") {
        return "file" /* File */;
      }
      if (CHOICE_INPUT_TYPES.has(inputType)) {
        return "choice" /* Choice */;
      }
      if (role2 === "combobox" || role2 === "listbox") {
        return "choice" /* Choice */;
      }
      return "textual" /* Textual */;
    }
    if (element instanceof HTMLTextAreaElement) {
      return "textual" /* Textual */;
    }
    if (element instanceof HTMLSelectElement) {
      return "choice" /* Choice */;
    }
    const role = getRole(element);
    if (role === "checkbox" || role === "radio") {
      return "boolean" /* Boolean */;
    }
    if (role === "combobox" || role === "listbox" || role === "slider") {
      return "choice" /* Choice */;
    }
    if (role === "textbox" || role === "spinbutton") {
      return "textual" /* Textual */;
    }
    if (element instanceof HTMLElement && element.isContentEditable) {
      return "textual" /* Textual */;
    }
    return "custom" /* Custom */;
  };
  var normalizeContextText = (rawValue) => rawValue.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
  var contextHasAnyTerm = (normalizedContext, terms) => terms.some((term) => normalizedContext.includes(term));
  var getElementContextText = (element) => {
    if (!(element instanceof HTMLElement)) {
      return "";
    }
    return normalizeContextText(
      [
        element.getAttribute("name") ?? "",
        element.getAttribute("id") ?? "",
        element.className,
        element.getAttribute("aria-label") ?? "",
        element.getAttribute("placeholder") ?? "",
        element.getAttribute("data-type") ?? "",
        element.getAttribute("data-category") ?? "",
        element.closest("label")?.textContent ?? ""
      ].filter(Boolean).join(" ")
    );
  };
  var canAutofill = (element) => {
    const normalizedContext = getElementContextText(element);
    if (normalizedContext && contextHasAnyTerm(normalizedContext, CAPTCHA_HINT_TERMS)) {
      return [false, "Field looks like CAPTCHA/verification and is intentionally skipped."];
    }
    if (element instanceof HTMLInputElement) {
      const inputType = element.type.toLowerCase();
      const isBooleanInput = BOOLEAN_INPUT_TYPES.has(inputType);
      if (isBooleanInput && normalizedContext && contextHasAnyTerm(normalizedContext, LEGAL_CONSENT_HINT_TERMS)) {
        return [false, "Legal consent checkbox is intentionally left for explicit user action."];
      }
    }
    if (element instanceof HTMLElement) {
      const blockedByPolicy = element.getAttribute("autocomplete")?.toLowerCase() === "off" && element.hasAttribute("data-autofill-blocked");
      if (blockedByPolicy) {
        return [false, "Field is blocked by site autofill policy markers."];
      }
    }
    return [true];
  };
  var isAshbyAutofillWidgetControl = (element) => element instanceof HTMLElement && Boolean(
    element.closest(`[class*="${ASHBY_AUTOFILL_CLASS_FRAGMENT}"]`)
  );
  var getBooleanGroupKey = (element) => {
    if (!(element instanceof HTMLInputElement)) {
      return null;
    }
    const inputType = element.type.toLowerCase();
    if (!BOOLEAN_INPUT_TYPES.has(inputType)) {
      return null;
    }
    const labeledOptionMatch = element.id.match(
      /^(.*)-labeled-(?:radio|checkbox)-\d+$/
    );
    if (labeledOptionMatch?.[1]) {
      return `choice-id:${labeledOptionMatch[1]}`;
    }
    if (element.name.trim()) {
      return `${inputType}-name:${element.name.trim()}`;
    }
    const groupContainer = element.closest(
      "fieldset, [role='radiogroup'], [role='group'], .ashby-application-form-field-entry"
    );
    if (groupContainer instanceof HTMLElement) {
      if (groupContainer.id.trim()) {
        return `${inputType}-group-id:${groupContainer.id.trim()}`;
      }
      const groupText = groupContainer.textContent?.replace(/\s+/g, " ").trim();
      if (groupText) {
        return `${inputType}-group-text:${groupText.slice(0, 120)}`;
      }
    }
    return null;
  };
  var getFieldCollections = (documentRoot) => {
    const seen = /* @__PURE__ */ new Set();
    const elements = [];
    const pushElement = (element) => {
      if (!isNativeFieldElement(element) || seen.has(element)) {
        return;
      }
      seen.add(element);
      elements.push(element);
    };
    documentRoot.querySelectorAll(NATIVE_FIELD_SELECTOR).forEach(pushElement);
    documentRoot.querySelectorAll(ARIA_FIELD_SELECTOR).forEach(pushElement);
    documentRoot.querySelectorAll(CONTENT_EDITABLE_SELECTOR).forEach(pushElement);
    return elements;
  };
  var discoverFormFields = (documentRoot) => {
    const fields = getFieldCollections(documentRoot);
    const discovered = [];
    const seenBooleanGroupKeys = /* @__PURE__ */ new Set();
    for (const [index, element] of fields.entries()) {
      if (isActionControl(element)) {
        continue;
      }
      if (!isElementVisible(element)) {
        continue;
      }
      if (isDisabledOrReadonly(element)) {
        continue;
      }
      if (isAshbyAutofillWidgetControl(element)) {
        continue;
      }
      const controlKind = classifyControlKind(element);
      if (controlKind === "boolean" /* Boolean */) {
        const booleanGroupKey = getBooleanGroupKey(element);
        if (booleanGroupKey) {
          if (seenBooleanGroupKeys.has(booleanGroupKey)) {
            continue;
          }
          seenBooleanGroupKeys.add(booleanGroupKey);
        }
      }
      const [fillable, skipReason] = canAutofill(element);
      if (!fillable) {
        continue;
      }
      discovered.push({
        id: `field-${index + 1}`,
        element,
        controlKind,
        fillable,
        skipReason
      });
    }
    return discovered;
  };

  // src/content/autofill/layer1/vocabulary.ts
  var GENERIC_TOKENS = /* @__PURE__ */ new Set([
    "value",
    "input",
    "text",
    "field",
    "data",
    "contact",
    "detail",
    "details",
    "information",
    "info"
  ]);
  var AUTOCOMPLETE_TYPE_MAP = {
    name: "full_name" /* FullName */,
    "given-name": "first_name" /* FirstName */,
    "additional-name": "first_name" /* FirstName */,
    "family-name": "last_name" /* LastName */,
    email: "email" /* Email */,
    tel: "phone" /* Phone */,
    "tel-national": "phone" /* Phone */,
    "tel-local": "phone" /* Phone */,
    "tel-local-prefix": "phone" /* Phone */,
    "tel-local-suffix": "phone" /* Phone */,
    "tel-country-code": "phone" /* Phone */,
    "street-address": "address_line1" /* AddressLine1 */,
    "address-line1": "address_line1" /* AddressLine1 */,
    "address-line2": "address_line2" /* AddressLine2 */,
    "address-level2": "city" /* City */,
    "address-level1": "state" /* State */,
    "postal-code": "postal_code" /* PostalCode */,
    country: "country" /* Country */,
    "country-name": "country" /* Country */,
    organization: "company" /* Company */,
    "organization-title": "job_title" /* JobTitle */,
    url: "website" /* Website */
  };
  var FIELD_TYPE_TOKENS = {
    ["first_name" /* FirstName */]: [
      { token: "first name", score: 1.2 },
      { token: "preferred first name", score: 1.25 },
      { token: "preferred name", score: 1.1 },
      "given name",
      "forename",
      "fname"
    ],
    ["last_name" /* LastName */]: [
      { token: "last name", score: 1.2 },
      "family name",
      "surname",
      "lname"
    ],
    ["full_name" /* FullName */]: [
      { token: "full name", score: 1.2 },
      { token: "first and last name", score: 1.35 },
      { token: "first last name", score: 1.3 },
      { token: "first name last name", score: 1.35 },
      { token: "name pronunciation", score: 1.15 },
      "your name",
      { token: "name", score: 0.5 }
    ],
    ["email" /* Email */]: [
      { token: "email", score: 1.2 },
      "e mail",
      { token: "email address", score: 1.2 },
      "mail"
    ],
    ["phone" /* Phone */]: [
      { token: "phone", score: 1.2 },
      "phone number",
      { token: "contact number", score: 1.2 },
      { token: "contact no", score: 1.15 },
      { token: "whatsapp", score: 1.25 },
      { token: "whatsapp number", score: 1.3 },
      { token: "whats app", score: 1.25 },
      { token: "whats app number", score: 1.3 },
      { token: "mobile", score: 1.2 },
      "mobile number",
      "telephone",
      "tel"
    ],
    ["address_line1" /* AddressLine1 */]: [
      "address line 1",
      "street address",
      "street",
      { token: "address", score: 0.7 },
      "address 1",
      "address1"
    ],
    ["address_line2" /* AddressLine2 */]: [
      { token: "address line 2", score: 1.25 },
      "apartment",
      "apt",
      "suite",
      "unit"
    ],
    ["city" /* City */]: [
      { token: "city", score: 1.25 },
      { token: "location city", score: 1.25 },
      { token: "current location", score: 1.2 },
      { token: "present location", score: 1.2 },
      { token: "work location", score: 1.2 },
      { token: "current work location", score: 1.25 },
      { token: "currently located", score: 1.2 },
      { token: "where are you currently located", score: 1.25 },
      { token: "location", score: 0.95 },
      { token: "city and state", score: 1.2 },
      "town",
      "current city"
    ],
    ["state" /* State */]: [
      { token: "state", score: 1.1 },
      "province",
      { token: "region", score: 0.45 }
    ],
    ["postal_code" /* PostalCode */]: [
      "postal code",
      "postcode",
      "zip",
      "zip code",
      "pincode",
      "pin code"
    ],
    ["country" /* Country */]: [
      { token: "country", score: 1.2 },
      { token: "country selector", score: 1.45 },
      { token: "nationality", score: 1.35 },
      { token: "citizenship", score: 1.25 },
      { token: "country region", score: 1.25 },
      { token: "work country", score: 1.15 },
      { token: "home country", score: 1.15 },
      "nation",
      { token: "country name", score: 1.15 }
    ],
    ["gender" /* Gender */]: [
      { token: "gender", score: 1.35 },
      { token: "sex", score: 1.15 },
      { token: "gender identity", score: 1.3 },
      { token: "pronouns", score: 1.1 },
      { token: "male female", score: 1.2 }
    ],
    ["company" /* Company */]: [
      { token: "company", score: 0.55 },
      "organization",
      "employer",
      "business",
      { token: "current company", score: 1.15 },
      { token: "employer name", score: 1.15 },
      { token: "most recent company", score: 1.15 },
      { token: "current or most recent company", score: 1.2 }
    ],
    ["job_title" /* JobTitle */]: [
      { token: "job title", score: 1.3 },
      { token: "current title", score: 1.2 },
      { token: "current role", score: 1.15 },
      { token: "current designation", score: 1.2 },
      { token: "profession", score: 1.25 },
      { token: "select profession", score: 1.3 },
      { token: "designation", score: 1.1 },
      { token: "professional title", score: 1.2 },
      { token: "position title", score: 1.2 },
      { token: "title", score: 0.65 },
      { token: "role", score: 0.2 },
      { token: "position", score: 0.2 }
    ],
    ["total_experience" /* TotalExperience */]: [
      { token: "total experience", score: 1.35 },
      { token: "total work experience", score: 1.35 },
      { token: "overall experience", score: 1.3 },
      { token: "years of experience", score: 1.25 },
      { token: "how many years of experience do you have", score: 1.45 },
      { token: "full time experience", score: 1.35 },
      { token: "years of full time experience", score: 1.45 },
      { token: "how many years of full time experience do you have", score: 1.5 },
      { token: "total years of experience", score: 1.35 },
      { token: "work experience", score: 1.15 },
      { token: "experience in years", score: 1.2 },
      { token: "professional experience", score: 1.15 }
    ],
    ["relevant_experience" /* RelevantExperience */]: [
      { token: "relevant experience", score: 1.35 },
      { token: "relevant years of experience", score: 1.35 },
      { token: "relevant work experience", score: 1.3 },
      { token: "experience relevant to this role", score: 1.3 },
      { token: "hands on experience", score: 0.9 },
      { token: "domain experience", score: 1.15 }
    ],
    ["skills" /* Skills */]: [
      { token: "technical skills", score: 1.35 },
      { token: "key skills", score: 1.3 },
      { token: "primary skills", score: 1.25 },
      { token: "core skills", score: 1.25 },
      { token: "hands on experience in", score: 1.3 },
      { token: "areas you have hands on experience in", score: 1.4 },
      { token: "select all that apply", score: 1.35 },
      { token: "check all that apply", score: 1.35 },
      { token: "choose all that apply", score: 1.35 },
      { token: "check the areas", score: 1.3 },
      { token: "skills", score: 1.05 },
      { token: "competencies", score: 1.2 }
    ],
    ["tech_stack" /* TechStack */]: [
      { token: "tech stack", score: 1.4 },
      { token: "technology stack", score: 1.35 },
      { token: "stack and architecture", score: 1.35 },
      { token: "architecture you ve worked on", score: 1.35 },
      { token: "technologies worked on", score: 1.3 },
      { token: "frameworks and tools", score: 1.2 },
      { token: "architecture", score: 0.85 },
      { token: "stack", score: 0.75 }
    ],
    ["scale_experience" /* ScaleExperience */]: [
      { token: "scale handling experience", score: 1.45 },
      { token: "scalability experience", score: 1.35 },
      { token: "large scale", score: 1.25 },
      { token: "millions of users", score: 1.35 },
      { token: "concurrent transactions", score: 1.3 },
      { token: "high traffic", score: 1.25 },
      { token: "system scale", score: 1.2 }
    ],
    ["professional_summary" /* ProfessionalSummary */]: [
      { token: "professional summary", score: 1.4 },
      { token: "profile summary", score: 1.35 },
      { token: "tell us about yourself", score: 1.35 },
      { token: "about yourself", score: 1.2 },
      { token: "introduce yourself", score: 1.3 },
      { token: "about you", score: 1.15 },
      { token: "short bio", score: 1.2 }
    ],
    ["project_summary" /* ProjectSummary */]: [
      { token: "projects built", score: 1.35 },
      { token: "project details", score: 1.25 },
      { token: "projects from scratch", score: 1.4 },
      { token: "built from scratch", score: 1.35 },
      { token: "project challenges", score: 1.25 },
      { token: "describe your projects", score: 1.3 },
      { token: "portfolio projects", score: 1.2 },
      { token: "projects", score: 0.9 }
    ],
    ["highest_education" /* HighestEducation */]: [
      { token: "highest education", score: 1.4 },
      { token: "highest qualification", score: 1.4 },
      { token: "education qualification", score: 1.3 },
      { token: "academic qualification", score: 1.3 },
      { token: "education", score: 1.05 },
      { token: "degree", score: 1.15 },
      { token: "college", score: 0.9 },
      { token: "university", score: 0.9 }
    ],
    ["graduation_year" /* GraduationYear */]: [
      { token: "graduation year", score: 1.45 },
      { token: "year of graduation", score: 1.45 },
      { token: "year of passing", score: 1.4 },
      { token: "passout year", score: 1.4 },
      { token: "graduated in", score: 1.35 },
      { token: "passing year", score: 1.35 }
    ],
    ["date_of_birth" /* DateOfBirth */]: [
      { token: "date of birth", score: 1.5 },
      { token: "birth date", score: 1.45 },
      { token: "dob", score: 1.4 },
      { token: "born on", score: 1.35 },
      { token: "your birthday", score: 1.25 }
    ],
    ["current_ctc" /* CurrentCtc */]: [
      { token: "current ctc", score: 1.25 },
      { token: "current annual pay", score: 1.35 },
      { token: "current annual pay fixed", score: 1.45 },
      { token: "current annual pay variable", score: 1.45 },
      { token: "ctc", score: 0.45 },
      { token: "current compensation", score: 1.2 },
      { token: "current salary", score: 1.2 },
      { token: "current pay", score: 1.1 },
      "current package",
      "present salary",
      "present compensation"
    ],
    ["expected_ctc" /* ExpectedCtc */]: [
      { token: "expected ctc", score: 1.3 },
      { token: "expected annual pay", score: 1.4 },
      { token: "expected compensation", score: 1.3 },
      { token: "compensation for this position", score: 1.25 },
      { token: "annual salary requirement", score: 1.3 },
      { token: "salary requirement", score: 1.2 },
      { token: "salary expectations", score: 1.3 },
      { token: "desired compensation", score: 1.3 },
      { token: "compensation expectation", score: 1.25 },
      { token: "expected pay", score: 1.2 },
      "expected annual compensation",
      "expected total compensation",
      "expected compensation range",
      "expected annual total compensation",
      "expected annual total compensation range",
      "annual total compensation expectation",
      "salary expectation",
      "expected salary",
      "expected package",
      "desired salary",
      { token: "desired ctc", score: 1.2 }
    ],
    ["notice_period" /* NoticePeriod */]: [
      "notice period",
      { token: "number of days", score: 1.3 },
      { token: "notice period days", score: 1.35 },
      { token: "availability to start", score: 1.2 },
      { token: "availability", score: 0.95 },
      { token: "date of availability", score: 1.2 },
      { token: "estimated date of your availability", score: 1.25 },
      { token: "when can you start", score: 1.2 },
      { token: "when you can start", score: 1.2 },
      { token: "how soon can you start", score: 1.2 },
      { token: "how soon would you be able to start", score: 1.25 },
      { token: "start date", score: 1.2 },
      { token: "earliest start date", score: 1.25 },
      { token: "earliest joining date", score: 1.25 },
      { token: "joining date", score: 1.2 },
      "notice period end",
      "notice end date",
      "last working day",
      "lwd",
      "relieving date",
      "serving notice"
    ],
    ["resume" /* Resume */]: [
      { token: "resume", score: 1.25 },
      { token: "cv", score: 1.25 },
      "resume cv",
      "curriculum vitae",
      "upload resume",
      "attach resume",
      "resume upload"
    ],
    ["linkedin" /* LinkedIn */]: [
      { token: "linkedin", score: 1.25 },
      { token: "linkedin url", score: 1.25 },
      { token: "linkedin profile", score: 1.25 },
      { token: "linkedin profile url", score: 1.3 },
      "linked in"
    ],
    ["github" /* GitHub */]: [
      { token: "github", score: 1.25 },
      "github profile",
      "git hub"
    ],
    ["leetcode" /* LeetCode */]: [
      { token: "leetcode", score: 1.35 },
      { token: "leetcode profile", score: 1.4 },
      { token: "coding profile", score: 1.1 },
      { token: "competitive profile", score: 1.1 }
    ],
    ["website" /* Website */]: [
      "website",
      { token: "website url", score: 1.2 },
      { token: "portfolio website", score: 1.25 },
      { token: "portfolio", score: 1.25 },
      "personal site"
    ],
    ["unknown" /* Unknown */]: []
  };
  var COMPENSATION_TERMS = [
    "compensation",
    "salary",
    "ctc",
    "pay",
    "annual salary"
  ];
  var EXPECTED_TERMS = [
    "expected",
    "desired",
    "expectation",
    "requirement",
    "requirements"
  ];
  var CURRENT_COMPENSATION_TERMS = [
    "current ctc",
    "current salary",
    "current compensation",
    "current pay",
    "present salary",
    "present compensation",
    "existing salary",
    "existing compensation"
  ];
  var LOCATION_CITY_TERMS = [
    "current location",
    "present location",
    "work location",
    "current work location",
    "location city",
    "city and state",
    "currently located",
    "where are you currently located",
    "city",
    "town"
  ];
  var GENERIC_LOCATION_TERMS = ["location"];
  var LINK_STYLE_TERMS = ["link", "url", "profile", "website", "portfolio"];
  var UPLOAD_STYLE_TERMS = ["upload", "attach", "file", "drop", "browse"];
  var TECH_STACK_TERMS = [
    "tech stack",
    "technology stack",
    "stack and architecture",
    "architecture you ve worked on",
    "architecture"
  ];
  var PROJECT_TERMS = [
    "projects built",
    "project details",
    "projects from scratch",
    "built from scratch",
    "project challenges",
    "describe your projects"
  ];
  var SCALE_TERMS = [
    "scale handling experience",
    "scalability experience",
    "large scale",
    "millions of users",
    "concurrent transactions",
    "high traffic"
  ];
  var COUNTRY_TERMS = ["country", "nation", "country region"];
  var CITY_TERMS = ["city", "town"];
  var SKILL_CHECKLIST_TERMS = [
    "areas you have hands on experience in",
    "hands on experience in",
    "select all that apply",
    "check all that apply",
    "choose all that apply",
    "check the areas"
  ];
  var WORK_AUTHORIZATION_TERMS = [
    "authorized to work",
    "authorization to work",
    "work authorization",
    "visa sponsorship",
    "require sponsorship"
  ];
  var RELOCATION_TERMS = [
    "relocation",
    "relocate",
    "open to working in person",
    "work in person",
    "intend to work",
    "where do you intend to work"
  ];
  var LEGAL_DISCLOSURE_TERMS = [
    "consent",
    "gdpr",
    "privacy notice",
    "terms and conditions",
    "terms of service",
    "privacy policy",
    "acknowledge",
    "government official",
    "outside business activities",
    "bound by any agreements",
    "non compete",
    "non solicitation",
    "intellectual property ownership",
    "legally eligible",
    "legally authorized",
    "work authorization",
    "require sponsorship",
    "retain or extend your work authorization",
    "have you ever worked for"
  ];
  var SOURCE_ATTRIBUTION_TERMS = [
    "how did you first hear",
    "how did you first learn",
    "where did you hear about",
    "how did you hear about",
    "how did you learn about"
  ];
  var BOOLEAN_LOCATION_TERMS = [
    "are you currently located in",
    "are you located in"
  ];
  var EMPLOYMENT_TYPE_TERMS = [
    "full time or part time position",
    "full time or part time",
    "full time position",
    "part time position"
  ];
  var TOTAL_EXPERIENCE_QUESTION_TERMS = [
    "how many years of experience do you have",
    "how many years of full time experience do you have",
    "years of full time experience",
    "full time experience"
  ];
  var JOB_TITLE_EXPLICIT_TERMS = [
    "job title",
    "position title",
    "current title",
    "professional title",
    "current designation"
  ];
  var ROLE_REFERENCE_TERMS = [
    "this role",
    "the role",
    "your role",
    "this position",
    "the position",
    "position you are applying for",
    "essential functions of this role",
    "related to the requirements of the position"
  ];
  var MOTIVATION_ESSAY_TERMS = [
    "why would you like to work with us",
    "why do you want to work with us",
    "why are you interested in this role",
    "why are you interested in working at",
    "why this role",
    "what motivates you"
  ];
  var COMBINED_NAME_TERMS = [
    "first and last name",
    "first name and last name",
    "first last name"
  ];
  var escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  var normalizeText = (rawValue) => {
    const withWordBoundaries = rawValue.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/([A-Za-z])(\d)/g, "$1 $2").replace(/(\d)([A-Za-z])/g, "$1 $2");
    return withWordBoundaries.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
  };
  var containsToken = (normalizedText, token) => {
    const pattern = new RegExp(`(^|\\s)${escapeRegExp(token)}(\\s|$)`);
    return pattern.test(normalizedText);
  };
  var toTokenPattern = (token) => {
    if (typeof token === "string") {
      return { token, score: 1 };
    }
    return {
      token: token.token,
      score: token.score ?? 1
    };
  };
  var containsPhrase = (normalizedText, phrase) => containsToken(normalizedText, phrase);
  var containsAnyPhrase = (normalizedText, phrases) => phrases.some((phrase) => containsPhrase(normalizedText, phrase));
  var applyContextAdjustments = (normalizedText, matches) => {
    const byFieldType = /* @__PURE__ */ new Map();
    for (const match of matches) {
      byFieldType.set(match.fieldType, { ...match });
    }
    const dampen = (fieldType, factor) => {
      const match = byFieldType.get(fieldType);
      if (!match) {
        return;
      }
      match.score = Number((match.score * factor).toFixed(4));
      byFieldType.set(fieldType, match);
    };
    const hasCompensationIntent = containsAnyPhrase(normalizedText, COMPENSATION_TERMS);
    const hasExpectedIntent = containsAnyPhrase(normalizedText, EXPECTED_TERMS);
    const hasCurrentCompensationIntent = containsAnyPhrase(
      normalizedText,
      CURRENT_COMPENSATION_TERMS
    );
    const hasCityLocationIntent = containsAnyPhrase(normalizedText, LOCATION_CITY_TERMS);
    const hasGenericLocationIntent = containsAnyPhrase(
      normalizedText,
      GENERIC_LOCATION_TERMS
    );
    const hasLinkStyleIntent = containsAnyPhrase(normalizedText, LINK_STYLE_TERMS);
    const hasUploadStyleIntent = containsAnyPhrase(normalizedText, UPLOAD_STYLE_TERMS);
    const hasTechStackIntent = containsAnyPhrase(normalizedText, TECH_STACK_TERMS);
    const hasProjectIntent = containsAnyPhrase(normalizedText, PROJECT_TERMS);
    const hasScaleIntent = containsAnyPhrase(normalizedText, SCALE_TERMS);
    const hasSkillChecklistIntent = containsAnyPhrase(
      normalizedText,
      SKILL_CHECKLIST_TERMS
    );
    const hasCountryIntent = containsAnyPhrase(normalizedText, COUNTRY_TERMS);
    const hasExplicitCityIntent = containsAnyPhrase(normalizedText, CITY_TERMS);
    const hasWorkAuthorizationIntent = containsAnyPhrase(
      normalizedText,
      WORK_AUTHORIZATION_TERMS
    );
    const hasRelocationIntent = containsAnyPhrase(normalizedText, RELOCATION_TERMS);
    const hasLegalDisclosureIntent = containsAnyPhrase(
      normalizedText,
      LEGAL_DISCLOSURE_TERMS
    );
    const hasSourceAttributionIntent = containsAnyPhrase(
      normalizedText,
      SOURCE_ATTRIBUTION_TERMS
    );
    const hasBooleanLocationIntent = containsAnyPhrase(
      normalizedText,
      BOOLEAN_LOCATION_TERMS
    );
    const hasEmploymentTypeIntent = containsAnyPhrase(
      normalizedText,
      EMPLOYMENT_TYPE_TERMS
    );
    const hasTotalExperienceQuestionIntent = containsAnyPhrase(
      normalizedText,
      TOTAL_EXPERIENCE_QUESTION_TERMS
    );
    const hasRoleReferenceIntent = containsAnyPhrase(
      normalizedText,
      ROLE_REFERENCE_TERMS
    );
    const hasExplicitJobTitleIntent = containsAnyPhrase(
      normalizedText,
      JOB_TITLE_EXPLICIT_TERMS
    );
    const hasMotivationEssayIntent = containsAnyPhrase(
      normalizedText,
      MOTIVATION_ESSAY_TERMS
    );
    const hasCombinedNameIntent = containsAnyPhrase(normalizedText, COMBINED_NAME_TERMS);
    if (hasCombinedNameIntent) {
      const fullNameMatch = byFieldType.get("full_name" /* FullName */);
      byFieldType.set("full_name" /* FullName */, {
        fieldType: "full_name" /* FullName */,
        score: Math.max(fullNameMatch?.score ?? 0, 1.35),
        token: fullNameMatch?.token ?? "first and last name"
      });
      dampen("first_name" /* FirstName */, 0.2);
      dampen("last_name" /* LastName */, 0.2);
    }
    if (hasCompensationIntent) {
      const jobTitleMatch = byFieldType.get("job_title" /* JobTitle */);
      if (jobTitleMatch && (jobTitleMatch.token === "position" || jobTitleMatch.token === "title" || jobTitleMatch.token === "role")) {
        jobTitleMatch.score = Number((jobTitleMatch.score * 0.35).toFixed(4));
        byFieldType.set("job_title" /* JobTitle */, jobTitleMatch);
      }
    }
    if (hasCompensationIntent && hasExpectedIntent) {
      const expectedMatch = byFieldType.get("expected_ctc" /* ExpectedCtc */);
      const boostedScore = Math.max(expectedMatch?.score ?? 0, 1.35);
      byFieldType.set("expected_ctc" /* ExpectedCtc */, {
        fieldType: "expected_ctc" /* ExpectedCtc */,
        score: boostedScore,
        token: expectedMatch?.token ?? "expected compensation"
      });
      if (!hasCurrentCompensationIntent) {
        const currentMatch = byFieldType.get("current_ctc" /* CurrentCtc */);
        if (currentMatch) {
          currentMatch.score = Number((currentMatch.score * 0.4).toFixed(4));
          byFieldType.set("current_ctc" /* CurrentCtc */, currentMatch);
        }
      }
    }
    if (hasCompensationIntent && hasCurrentCompensationIntent) {
      const currentMatch = byFieldType.get("current_ctc" /* CurrentCtc */);
      const boostedScore = Math.max(currentMatch?.score ?? 0, 1.3);
      byFieldType.set("current_ctc" /* CurrentCtc */, {
        fieldType: "current_ctc" /* CurrentCtc */,
        score: boostedScore,
        token: currentMatch?.token ?? "current compensation"
      });
      if (!hasExpectedIntent) {
        const expectedMatch = byFieldType.get("expected_ctc" /* ExpectedCtc */);
        if (expectedMatch) {
          expectedMatch.score = Number((expectedMatch.score * 0.4).toFixed(4));
          byFieldType.set("expected_ctc" /* ExpectedCtc */, expectedMatch);
        }
      }
    }
    if (hasCityLocationIntent) {
      const cityMatch = byFieldType.get("city" /* City */);
      const boostedScore = hasCountryIntent && !hasExplicitCityIntent ? Math.min(Math.max(cityMatch?.score ?? 0, 0.95), 1.05) : Math.max(cityMatch?.score ?? 0, 1.3);
      byFieldType.set("city" /* City */, {
        fieldType: "city" /* City */,
        score: boostedScore,
        token: cityMatch?.token ?? "current location"
      });
      const countryMatch = byFieldType.get("country" /* Country */);
      if (countryMatch) {
        if (hasCountryIntent && !hasExplicitCityIntent) {
          countryMatch.score = Math.max(countryMatch.score, 1.25);
        } else {
          countryMatch.score = Number((countryMatch.score * 0.55).toFixed(4));
        }
        byFieldType.set("country" /* Country */, countryMatch);
      }
    }
    if (!hasCityLocationIntent && hasGenericLocationIntent) {
      const cityMatch = byFieldType.get("city" /* City */);
      if (cityMatch) {
        cityMatch.score = Math.max(cityMatch.score, 1.05);
        byFieldType.set("city" /* City */, cityMatch);
      }
    }
    if (hasLinkStyleIntent && !hasUploadStyleIntent) {
      const resumeMatch = byFieldType.get("resume" /* Resume */);
      const linkedinMatch = byFieldType.get("linkedin" /* LinkedIn */);
      const websiteMatch = byFieldType.get("website" /* Website */);
      const githubMatch = byFieldType.get("github" /* GitHub */);
      const leetCodeMatch = byFieldType.get("leetcode" /* LeetCode */);
      if (resumeMatch && (linkedinMatch || websiteMatch || githubMatch || leetCodeMatch)) {
        resumeMatch.score = Number((resumeMatch.score * 0.3).toFixed(4));
        byFieldType.set("resume" /* Resume */, resumeMatch);
      }
      if (linkedinMatch) {
        linkedinMatch.score = Math.max(linkedinMatch.score, 1.3);
        byFieldType.set("linkedin" /* LinkedIn */, linkedinMatch);
      }
    }
    if (hasTechStackIntent) {
      const techStackMatch = byFieldType.get("tech_stack" /* TechStack */);
      byFieldType.set("tech_stack" /* TechStack */, {
        fieldType: "tech_stack" /* TechStack */,
        score: Math.max(techStackMatch?.score ?? 0, 1.4),
        token: techStackMatch?.token ?? "tech stack"
      });
      const skillsMatch = byFieldType.get("skills" /* Skills */);
      if (skillsMatch) {
        skillsMatch.score = Number((skillsMatch.score * 0.65).toFixed(4));
        byFieldType.set("skills" /* Skills */, skillsMatch);
      }
    }
    if (hasProjectIntent) {
      const projectMatch = byFieldType.get("project_summary" /* ProjectSummary */);
      byFieldType.set("project_summary" /* ProjectSummary */, {
        fieldType: "project_summary" /* ProjectSummary */,
        score: Math.max(projectMatch?.score ?? 0, 1.35),
        token: projectMatch?.token ?? "projects built"
      });
      const addressLine1Match = byFieldType.get("address_line1" /* AddressLine1 */);
      if (addressLine1Match) {
        addressLine1Match.score = Number((addressLine1Match.score * 0.25).toFixed(4));
        byFieldType.set("address_line1" /* AddressLine1 */, addressLine1Match);
      }
    }
    if (hasScaleIntent) {
      const scaleMatch = byFieldType.get("scale_experience" /* ScaleExperience */);
      byFieldType.set("scale_experience" /* ScaleExperience */, {
        fieldType: "scale_experience" /* ScaleExperience */,
        score: Math.max(scaleMatch?.score ?? 0, 1.4),
        token: scaleMatch?.token ?? "scale handling experience"
      });
    }
    if (hasSkillChecklistIntent) {
      const skillsMatch = byFieldType.get("skills" /* Skills */);
      byFieldType.set("skills" /* Skills */, {
        fieldType: "skills" /* Skills */,
        score: Math.max(skillsMatch?.score ?? 0, 1.4),
        token: skillsMatch?.token ?? "hands on experience in"
      });
      const relevantExperienceMatch = byFieldType.get("relevant_experience" /* RelevantExperience */);
      if (relevantExperienceMatch) {
        relevantExperienceMatch.score = Number(
          (relevantExperienceMatch.score * 0.55).toFixed(4)
        );
        byFieldType.set("relevant_experience" /* RelevantExperience */, relevantExperienceMatch);
      }
    }
    if (hasTotalExperienceQuestionIntent) {
      const totalExperienceMatch = byFieldType.get("total_experience" /* TotalExperience */);
      byFieldType.set("total_experience" /* TotalExperience */, {
        fieldType: "total_experience" /* TotalExperience */,
        score: Math.max(totalExperienceMatch?.score ?? 0, 1.45),
        token: totalExperienceMatch?.token ?? "how many years of experience do you have"
      });
      const relevantExperienceMatch = byFieldType.get("relevant_experience" /* RelevantExperience */);
      if (relevantExperienceMatch) {
        relevantExperienceMatch.score = Number(
          (relevantExperienceMatch.score * 0.6).toFixed(4)
        );
        byFieldType.set("relevant_experience" /* RelevantExperience */, relevantExperienceMatch);
      }
    }
    if (hasUploadStyleIntent) {
      const resumeMatch = byFieldType.get("resume" /* Resume */);
      if (resumeMatch) {
        resumeMatch.score = Math.max(resumeMatch.score, 1.35);
        byFieldType.set("resume" /* Resume */, resumeMatch);
      }
    }
    if (hasWorkAuthorizationIntent) {
      dampen("country" /* Country */, 0.1);
      dampen("city" /* City */, 0.1);
      dampen("company" /* Company */, 0.1);
    }
    if (hasRelocationIntent) {
      dampen("job_title" /* JobTitle */, 0.2);
    }
    if (hasLegalDisclosureIntent) {
      dampen("company" /* Company */, 0.1);
      dampen("country" /* Country */, 0.1);
      dampen("city" /* City */, 0.1);
      dampen("first_name" /* FirstName */, 0.1);
      dampen("last_name" /* LastName */, 0.1);
      dampen("full_name" /* FullName */, 0.1);
      dampen("job_title" /* JobTitle */, 0.1);
      dampen("date_of_birth" /* DateOfBirth */, 0.1);
      dampen("current_ctc" /* CurrentCtc */, 0.1);
      dampen("expected_ctc" /* ExpectedCtc */, 0.1);
    }
    if (hasSourceAttributionIntent) {
      dampen("company" /* Company */, 0.1);
      dampen("first_name" /* FirstName */, 0.1);
      dampen("last_name" /* LastName */, 0.1);
      dampen("full_name" /* FullName */, 0.1);
      dampen("job_title" /* JobTitle */, 0.1);
      dampen("city" /* City */, 0.2);
      dampen("country" /* Country */, 0.2);
    }
    if (hasMotivationEssayIntent) {
      dampen("job_title" /* JobTitle */, 0.1);
      dampen("city" /* City */, 0.1);
      dampen("country" /* Country */, 0.1);
      dampen("company" /* Company */, 0.1);
    }
    if (hasBooleanLocationIntent && !hasExplicitCityIntent) {
      dampen("city" /* City */, 0.1);
      dampen("country" /* Country */, 0.1);
    }
    if (hasEmploymentTypeIntent) {
      dampen("job_title" /* JobTitle */, 0.1);
    }
    if (hasRoleReferenceIntent && !hasExplicitJobTitleIntent) {
      dampen("job_title" /* JobTitle */, 0.1);
    }
    return Array.from(byFieldType.values());
  };
  var getMatchesFromText = (rawValue) => {
    const normalized = normalizeText(rawValue);
    if (!normalized) {
      return [];
    }
    const results = [];
    for (const fieldType of FIELD_TYPES) {
      if (fieldType === "unknown" /* Unknown */) {
        continue;
      }
      const tokens = FIELD_TYPE_TOKENS[fieldType];
      let strongestMatch = null;
      for (const rawToken of tokens) {
        const tokenPattern = toTokenPattern(rawToken);
        if (!containsToken(normalized, tokenPattern.token)) {
          continue;
        }
        if (!strongestMatch) {
          strongestMatch = tokenPattern;
          continue;
        }
        if (tokenPattern.score > strongestMatch.score) {
          strongestMatch = tokenPattern;
          continue;
        }
        if (tokenPattern.score === strongestMatch.score && tokenPattern.token.length > strongestMatch.token.length) {
          strongestMatch = tokenPattern;
        }
      }
      if (strongestMatch) {
        results.push({
          fieldType,
          score: strongestMatch.score,
          token: strongestMatch.token
        });
      }
    }
    return applyContextAdjustments(normalized, results);
  };
  var getMatchesFromAutocomplete = (rawValue) => {
    const tokens = rawValue.toLowerCase().trim().split(/\s+/).map((token) => token.trim()).filter(Boolean);
    const matches = [];
    for (const token of tokens) {
      const mapped = AUTOCOMPLETE_TYPE_MAP[token];
      if (mapped && !matches.includes(mapped)) {
        matches.push(mapped);
      }
    }
    return matches;
  };
  var isGenericText = (rawValue) => {
    const normalized = normalizeText(rawValue);
    if (!normalized) {
      return true;
    }
    const tokens = normalized.split(" ").filter(Boolean);
    if (tokens.length === 0) {
      return true;
    }
    return tokens.every((token) => GENERIC_TOKENS.has(token));
  };

  // src/content/autofill/scoring-utils.ts
  var clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  var createBaseTypeScores = () => {
    const scores = {};
    for (const fieldType of FIELD_TYPES) {
      scores[fieldType] = 0;
    }
    return scores;
  };
  var getTopTwoScoredTypes = (typeScores) => {
    const sorted = [...FIELD_TYPES].filter((fieldType) => fieldType !== "unknown" /* Unknown */).sort((left, right) => typeScores[right] - typeScores[left]);
    const topType = sorted[0] ?? "unknown" /* Unknown */;
    const secondType = sorted[1] ?? "unknown" /* Unknown */;
    return {
      topType,
      topScore: typeScores[topType] ?? 0,
      secondType,
      secondScore: typeScores[secondType] ?? 0
    };
  };

  // src/content/autofill/layer1/scoring.ts
  var ACCEPT_THRESHOLD = 0.9;
  var REVIEW_THRESHOLD = 0.5;
  var MARGIN_DIVISOR = 0.35;
  var CONFLICT_PENALTY = 0.25;
  var GENERIC_TEXT_PENALTY = 0.1;
  var STRONG_EVIDENCE_WEIGHT = 0.75;
  var SIGNAL_WEIGHTS = {
    ["label_for" /* LabelFor */]: 1,
    ["label_wrap" /* LabelWrap */]: 0.95,
    ["aria_labelledby" /* AriaLabelledBy */]: 0.9,
    ["autocomplete" /* Autocomplete */]: 0.85,
    ["aria_label" /* AriaLabel */]: 0.8,
    ["name" /* Name */]: 0.65,
    ["id" /* Id */]: 0.65,
    ["placeholder" /* Placeholder */]: 0.45
  };
  var HIGH_PRIORITY_SIGNALS = /* @__PURE__ */ new Set([
    "label_for" /* LabelFor */,
    "label_wrap" /* LabelWrap */,
    "aria_labelledby" /* AriaLabelledBy */,
    "autocomplete" /* Autocomplete */
  ]);
  var STRONG_FIRST_NAME_PATTERNS = [
    /(^|[^a-z0-9])(first|given)[ _-]?name([^a-z0-9]|$)/i,
    /(^|[^a-z0-9])fname([^a-z0-9]|$)/i
  ];
  var STRONG_LAST_NAME_PATTERNS = [
    /(^|[^a-z0-9])(last|family|sur)[ _-]?name([^a-z0-9]|$)/i,
    /(^|[^a-z0-9])lname([^a-z0-9]|$)/i
  ];
  var FIRST_NAME_PLACEHOLDER_HINTS = /* @__PURE__ */ new Set(["first", "first name", "given name"]);
  var LAST_NAME_PLACEHOLDER_HINTS = /* @__PURE__ */ new Set(["last", "last name", "family name"]);
  var FULL_NAME_LABEL_HINTS = /* @__PURE__ */ new Set([
    "name",
    "your name",
    "full name",
    "candidate name"
  ]);
  var normalizeHintText = (value) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
  var hasPatternSignalMatch = (values, patterns) => values.some((value) => patterns.some((pattern) => pattern.test(value)));
  var hasStrongFirstNameSignal = (signals) => {
    const idLikeValues = [
      ...signals["name" /* Name */] ?? [],
      ...signals["id" /* Id */] ?? [],
      ...signals["autocomplete" /* Autocomplete */] ?? []
    ];
    if (hasPatternSignalMatch(idLikeValues, STRONG_FIRST_NAME_PATTERNS)) {
      return true;
    }
    const normalizedPlaceholders = (signals["placeholder" /* Placeholder */] ?? []).map(
      normalizeHintText
    );
    const hasFirstPlaceholder = normalizedPlaceholders.some(
      (placeholder) => FIRST_NAME_PLACEHOLDER_HINTS.has(placeholder)
    );
    return hasFirstPlaceholder && hasPatternSignalMatch(idLikeValues, [/first|given/i]);
  };
  var hasStrongLastNameSignal = (signals) => {
    const idLikeValues = [
      ...signals["name" /* Name */] ?? [],
      ...signals["id" /* Id */] ?? [],
      ...signals["autocomplete" /* Autocomplete */] ?? []
    ];
    if (hasPatternSignalMatch(idLikeValues, STRONG_LAST_NAME_PATTERNS)) {
      return true;
    }
    const normalizedPlaceholders = (signals["placeholder" /* Placeholder */] ?? []).map(
      normalizeHintText
    );
    const hasLastPlaceholder = normalizedPlaceholders.some(
      (placeholder) => LAST_NAME_PLACEHOLDER_HINTS.has(placeholder)
    );
    return hasLastPlaceholder && hasPatternSignalMatch(idLikeValues, [/last|family|sur/i]);
  };
  var hasStrongFullNameSignal = (signals) => {
    const labelValues = [
      ...signals["label_for" /* LabelFor */] ?? [],
      ...signals["label_wrap" /* LabelWrap */] ?? [],
      ...signals["aria_labelledby" /* AriaLabelledBy */] ?? [],
      ...signals["aria_label" /* AriaLabel */] ?? []
    ].map(normalizeHintText);
    if (labelValues.length === 0) {
      return false;
    }
    const hasStrongNameLabel = labelValues.some(
      (value) => FULL_NAME_LABEL_HINTS.has(value)
    );
    if (!hasStrongNameLabel) {
      return false;
    }
    if (hasStrongFirstNameSignal(signals) || hasStrongLastNameSignal(signals)) {
      return false;
    }
    return true;
  };
  var hasStrongCountrySignal = (signals) => {
    const hintValues = [
      ...signals["aria_label" /* AriaLabel */] ?? [],
      ...signals["aria_labelledby" /* AriaLabelledBy */] ?? [],
      ...signals["name" /* Name */] ?? [],
      ...signals["id" /* Id */] ?? []
    ].map(normalizeHintText);
    return hintValues.some(
      (value) => value.includes("country selector") || value === "country"
    );
  };
  var hasStrongConflict = (evidence) => {
    const dominantTypeBySignal = /* @__PURE__ */ new Map();
    for (const item of evidence) {
      if (!HIGH_PRIORITY_SIGNALS.has(item.signal)) {
        continue;
      }
      if (item.weight < STRONG_EVIDENCE_WEIGHT) {
        continue;
      }
      const existing = dominantTypeBySignal.get(item.signal);
      if (!existing || item.weight > existing.weight) {
        dominantTypeBySignal.set(item.signal, item);
      }
    }
    if (dominantTypeBySignal.size < 2) {
      return false;
    }
    const topSignalTypes = new Set(
      Array.from(dominantTypeBySignal.values(), (item) => item.matchedType)
    );
    return topSignalTypes.size > 1;
  };
  var hasGenericOnlySignals = (signals) => {
    const rawValues = Object.values(signals).flatMap((values) => values);
    if (rawValues.length === 0) {
      return false;
    }
    return rawValues.every((value) => isGenericText(value));
  };
  var getStatusForConfidence = (confidence, hasMatch) => {
    if (!hasMatch) {
      return "unresolved" /* Unresolved */;
    }
    if (confidence >= ACCEPT_THRESHOLD) {
      return "resolved" /* Resolved */;
    }
    if (confidence >= REVIEW_THRESHOLD) {
      return "ambiguous" /* Ambiguous */;
    }
    return "unresolved" /* Unresolved */;
  };
  var scoreLayer1Signals = (signals) => {
    const typeScores = createBaseTypeScores();
    const evidence = [];
    for (const signalType of Object.values(SignalType)) {
      const signalValues = signals[signalType];
      if (!signalValues || signalValues.length === 0) {
        continue;
      }
      const signalWeight = SIGNAL_WEIGHTS[signalType];
      for (const rawValue of signalValues) {
        if (!rawValue.trim()) {
          continue;
        }
        if (signalType === "autocomplete" /* Autocomplete */) {
          const matches2 = getMatchesFromAutocomplete(rawValue);
          for (const matchedType of matches2) {
            typeScores[matchedType] += signalWeight;
            evidence.push({
              signal: signalType,
              rawValue,
              matchedType,
              weight: signalWeight
            });
          }
          continue;
        }
        const matches = getMatchesFromText(rawValue);
        for (const match of matches) {
          const weightedScore = signalWeight * match.score;
          typeScores[match.fieldType] += weightedScore;
          evidence.push({
            signal: signalType,
            rawValue,
            matchedType: match.fieldType,
            weight: weightedScore
          });
        }
      }
    }
    const hasCountrySelectorSignal = hasStrongCountrySignal(signals);
    if (hasCountrySelectorSignal) {
      typeScores["country" /* Country */] = Math.max(typeScores["country" /* Country */], 1.2);
      typeScores["phone" /* Phone */] = Number(
        (typeScores["phone" /* Phone */] * 0.35).toFixed(4)
      );
    }
    const { topType, topScore, secondScore } = getTopTwoScoredTypes(typeScores);
    const conflictPenalty = hasStrongConflict(evidence) ? CONFLICT_PENALTY : 0;
    const genericPenalty = hasGenericOnlySignals(signals) ? GENERIC_TEXT_PENALTY : 0;
    let adjustedTopScore = Math.max(
      0,
      topScore - conflictPenalty - genericPenalty
    );
    if (topType === "first_name" /* FirstName */ && hasStrongFirstNameSignal(signals)) {
      adjustedTopScore = Math.max(adjustedTopScore, 0.95);
    }
    if (topType === "last_name" /* LastName */ && hasStrongLastNameSignal(signals)) {
      adjustedTopScore = Math.max(adjustedTopScore, 0.95);
    }
    if (topType === "full_name" /* FullName */ && hasStrongFullNameSignal(signals)) {
      adjustedTopScore = Math.max(adjustedTopScore, 0.92);
    }
    if (topType === "country" /* Country */ && hasStrongCountrySignal(signals)) {
      adjustedTopScore = Math.max(adjustedTopScore, 0.95);
    }
    const absScore = clamp(adjustedTopScore, 0, 1);
    const marginScore = clamp(
      (adjustedTopScore - secondScore) / MARGIN_DIVISOR,
      0,
      1
    );
    const confidence = Number((0.7 * absScore + 0.3 * marginScore).toFixed(4));
    const hasMatch = adjustedTopScore > 0;
    return {
      fieldType: hasMatch ? topType : "unknown" /* Unknown */,
      confidence,
      status: getStatusForConfidence(confidence, hasMatch),
      evidence,
      typeScores
    };
  };

  // src/content/autofill/layer1/layer1.ts
  var initializeSignals = () => ({
    ["label_for" /* LabelFor */]: [],
    ["label_wrap" /* LabelWrap */]: [],
    ["aria_labelledby" /* AriaLabelledBy */]: [],
    ["autocomplete" /* Autocomplete */]: [],
    ["aria_label" /* AriaLabel */]: [],
    ["name" /* Name */]: [],
    ["id" /* Id */]: [],
    ["placeholder" /* Placeholder */]: []
  });
  var addUniqueSignal = (signals, signalType, rawValue) => {
    if (!rawValue) {
      return;
    }
    const trimmedValue = rawValue.trim();
    if (!trimmedValue) {
      return;
    }
    if (!signals[signalType].includes(trimmedValue)) {
      signals[signalType].push(trimmedValue);
    }
  };
  var CONTEXT_SIGNAL_MAX_DEPTH = 4;
  var CONTEXT_SIGNAL_MAX_LENGTH = 140;
  var CONTEXT_SIGNAL_MIN_LENGTH = 2;
  var INTERACTIVE_CONTEXT_SELECTOR = [
    "input",
    "textarea",
    "select",
    "button",
    "[role='button']",
    "[role='checkbox']",
    "[role='radio']",
    "[role='combobox']",
    "[role='listbox']",
    "[role='option']"
  ].join(",");
  var collapseText = (rawValue) => rawValue.replace(/\s+/g, " ").trim();
  var toContextSignalText = (element) => {
    const text = collapseText(element.textContent ?? "");
    if (text.length < CONTEXT_SIGNAL_MIN_LENGTH || text.length > CONTEXT_SIGNAL_MAX_LENGTH) {
      return null;
    }
    return text;
  };
  var isContextSignalCandidate = (element) => {
    if (element.matches(INTERACTIVE_CONTEXT_SELECTOR)) {
      return false;
    }
    if (element.querySelector(DISCOVERABLE_FIELD_SELECTOR)) {
      return false;
    }
    return true;
  };
  var extractAdjacentContextLabels = (field, signals) => {
    if (!(field.element instanceof HTMLElement)) {
      return;
    }
    let current = field.element;
    for (let depth = 0; depth < CONTEXT_SIGNAL_MAX_DEPTH && current?.parentElement; depth += 1) {
      const previousSibling = current.previousElementSibling;
      if (previousSibling instanceof HTMLElement && isContextSignalCandidate(previousSibling)) {
        const contextText = toContextSignalText(previousSibling);
        if (contextText) {
          addUniqueSignal(signals, "label_wrap" /* LabelWrap */, contextText);
        }
      }
      current = current.parentElement;
    }
  };
  var isLabelableElement = (element) => element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement;
  var extractLabelForValues = (field, signals) => {
    const { element } = field;
    if (!isLabelableElement(element)) {
      return;
    }
    if (element.labels) {
      for (const label of Array.from(element.labels)) {
        const text = label.textContent;
        if (label.htmlFor) {
          addUniqueSignal(signals, "label_for" /* LabelFor */, text);
        } else {
          addUniqueSignal(signals, "label_wrap" /* LabelWrap */, text);
        }
      }
    }
    if (!element.id) {
      return;
    }
    const safeId = window.CSS?.escape ? window.CSS.escape(element.id) : element.id.replace(/"/g, '\\"');
    const explicitLabels = element.ownerDocument.querySelectorAll(
      `label[for="${safeId}"]`
    );
    for (const label of Array.from(explicitLabels)) {
      addUniqueSignal(signals, "label_for" /* LabelFor */, label.textContent);
    }
  };
  var extractWrappedLabelValue = (field, signals) => {
    if (!(field.element instanceof HTMLElement)) {
      return;
    }
    const wrappedLabel = field.element.closest("label");
    addUniqueSignal(signals, "label_wrap" /* LabelWrap */, wrappedLabel?.textContent);
  };
  var extractAriaLabelledByValues = (field, signals) => {
    if (!(field.element instanceof HTMLElement)) {
      return;
    }
    const labelledBy = field.element.getAttribute("aria-labelledby");
    if (!labelledBy) {
      return;
    }
    const referencedIds = labelledBy.split(/\s+/).filter(Boolean);
    for (const id of referencedIds) {
      const labelElement = field.element.ownerDocument.getElementById(id);
      addUniqueSignal(
        signals,
        "aria_labelledby" /* AriaLabelledBy */,
        labelElement?.textContent
      );
    }
  };
  var extractAttributeSignals = (field, signals) => {
    const { element } = field;
    if (element instanceof HTMLElement) {
      addUniqueSignal(
        signals,
        "autocomplete" /* Autocomplete */,
        element.getAttribute("autocomplete")
      );
      addUniqueSignal(
        signals,
        "aria_label" /* AriaLabel */,
        element.getAttribute("aria-label")
      );
      addUniqueSignal(signals, "name" /* Name */, element.getAttribute("name"));
      addUniqueSignal(signals, "id" /* Id */, element.getAttribute("id"));
      addUniqueSignal(
        signals,
        "placeholder" /* Placeholder */,
        element.getAttribute("placeholder")
      );
    }
    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) {
      addUniqueSignal(signals, "name" /* Name */, element.name);
      addUniqueSignal(signals, "id" /* Id */, element.id);
    }
    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
      addUniqueSignal(signals, "placeholder" /* Placeholder */, element.placeholder);
    }
  };
  var extractSignalsForField = (field) => {
    const signals = initializeSignals();
    extractLabelForValues(field, signals);
    extractWrappedLabelValue(field, signals);
    extractAriaLabelledByValues(field, signals);
    extractAttributeSignals(field, signals);
    extractAdjacentContextLabels(field, signals);
    return signals;
  };
  var evaluateFieldWithLayer1 = (field) => {
    const signals = extractSignalsForField(field);
    const scored = scoreLayer1Signals(signals);
    const normalizedScore = (() => {
      if (field.controlKind !== "file" /* File */) {
        return scored;
      }
      if (scored.fieldType !== "resume" /* Resume */) {
        return {
          ...scored,
          fieldType: "unknown" /* Unknown */,
          confidence: 0,
          status: "unresolved" /* Unresolved */
        };
      }
      if (scored.status === "resolved" /* Resolved */ || scored.confidence < 0.85) {
        return scored;
      }
      return {
        ...scored,
        status: "resolved" /* Resolved */,
        confidence: Number(Math.max(scored.confidence, 0.9).toFixed(4))
      };
    })();
    return {
      fieldId: field.id,
      element: field.element,
      controlKind: field.controlKind,
      fillable: field.fillable,
      skipReason: field.skipReason,
      resolutionLayer: "layer1",
      signals,
      ...normalizedScore
    };
  };

  // src/content/autofill/layer2/layer2-candidates.ts
  var MIN_TEXT_LENGTH = 2;
  var MAX_TEXT_LENGTH = 180;
  var TECHNICAL_TAGS = /* @__PURE__ */ new Set([
    "script",
    "style",
    "noscript",
    "svg",
    "path",
    "code",
    "pre",
    "meta",
    "link",
    "head",
    "title"
  ]);
  var FORMAT_WRAPPER_TAGS = /* @__PURE__ */ new Set([
    "strong",
    "em",
    "b",
    "i",
    "small",
    "mark",
    "u",
    "s",
    "sub",
    "sup"
  ]);
  var INTERACTIVE_SELECTOR = [
    "input",
    "textarea",
    "select",
    "button",
    "a[href]",
    "summary",
    "details",
    "[contenteditable='true']",
    "[contenteditable='plaintext-only']",
    "[tabindex]:not([tabindex='-1'])",
    "[role='button']",
    "[role='checkbox']",
    "[role='radio']",
    "[role='combobox']",
    "[role='listbox']",
    "[role='menuitem']",
    "[role='option']",
    "[role='switch']",
    "[role='textbox']"
  ].join(",");
  var HELPER_TEXT_PATTERNS = [
    /\bthis field\b/i,
    /\brequired field\b/i,
    /\binvalid characters?\b/i,
    /\bis required\b/i,
    /\bmust be at least\b/i,
    /\bcannot be empty\b/i
  ];
  var HELPER_CLASS_PATTERNS = /error|invalid|helper|hint|warning|feedback/i;
  var OPTION_INPUT_TYPES = /* @__PURE__ */ new Set(["checkbox", "radio"]);
  var OPTION_LIKE_ROLES = /* @__PURE__ */ new Set([
    "checkbox",
    "radio",
    "option",
    "switch",
    "menuitemcheckbox",
    "menuitemradio"
  ]);
  var toCollapsedText = (value) => value.replace(/\s+/g, " ").trim();
  var isTechnicalTag = (element) => TECHNICAL_TAGS.has(element.tagName.toLowerCase());
  var isInteractiveElement = (element) => element.matches(INTERACTIVE_SELECTOR);
  var hasInteractiveAncestor = (element) => element.parentElement?.closest(INTERACTIVE_SELECTOR) !== null;
  var hasInteractiveControlLabelAncestor = (element) => {
    const wrappingLabel = element.closest("label");
    if (!wrappingLabel) {
      return false;
    }
    return wrappingLabel.querySelector("input, textarea, select, button") !== null;
  };
  var hasOptionControlLabelForAncestor = (element) => {
    const wrappingLabel = element.closest("label");
    if (!(wrappingLabel instanceof HTMLLabelElement)) {
      return false;
    }
    const targetId = wrappingLabel.htmlFor.trim();
    if (!targetId) {
      return false;
    }
    const targetElement = wrappingLabel.ownerDocument.getElementById(targetId);
    if (!targetElement) {
      return false;
    }
    if (targetElement instanceof HTMLInputElement) {
      return OPTION_INPUT_TYPES.has(targetElement.type.toLowerCase());
    }
    const role = targetElement.getAttribute("role")?.toLowerCase();
    return role ? OPTION_LIKE_ROLES.has(role) : false;
  };
  var hasHelperClassOrId = (element) => {
    const classValue = typeof element.className === "string" ? element.className : "";
    const idValue = element.id ?? "";
    const dataErrorValue = element.getAttribute("data-error-for") ?? "";
    const dataQaValue = element.getAttribute("data-qa") ?? "";
    const merged = `${classValue} ${idValue} ${dataErrorValue} ${dataQaValue}`;
    return HELPER_CLASS_PATTERNS.test(merged);
  };
  var isLikelyHelperText = (normalizedText, element) => {
    if (!normalizedText) {
      return true;
    }
    if (hasHelperClassOrId(element)) {
      return true;
    }
    return HELPER_TEXT_PATTERNS.some((pattern) => pattern.test(normalizedText));
  };
  var hasSeenTextForElement = (seenByElement, element, normalizedText) => {
    const seenTexts = seenByElement.get(element);
    if (seenTexts?.has(normalizedText)) {
      return true;
    }
    if (!seenTexts) {
      seenByElement.set(element, /* @__PURE__ */ new Set([normalizedText]));
      return false;
    }
    seenTexts.add(normalizedText);
    return false;
  };
  var toMeaningfulAncestor = (textNode) => {
    let current = textNode.parentElement;
    while (current) {
      if (isTechnicalTag(current)) {
        return null;
      }
      if (FORMAT_WRAPPER_TAGS.has(current.tagName.toLowerCase())) {
        current = current.parentElement;
        continue;
      }
      return current;
    }
    return null;
  };
  var isCandidateElementValid = (element) => {
    if (!isElementVisible(element)) {
      return false;
    }
    if (isTechnicalTag(element)) {
      return false;
    }
    if (isInteractiveElement(element)) {
      return false;
    }
    if (hasInteractiveAncestor(element)) {
      return false;
    }
    if (hasInteractiveControlLabelAncestor(element)) {
      return false;
    }
    if (hasOptionControlLabelForAncestor(element)) {
      return false;
    }
    return true;
  };
  var getWalkerRoot = (documentRoot) => documentRoot.body ?? documentRoot.documentElement;
  var collectLabelLikeCandidates = (documentRoot) => {
    const root = getWalkerRoot(documentRoot);
    const walker = documentRoot.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const candidates = [];
    const seenByElement = /* @__PURE__ */ new WeakMap();
    let currentNode = walker.nextNode();
    while (currentNode) {
      const textNode = currentNode;
      const rawText = toCollapsedText(textNode.nodeValue ?? "");
      if (!rawText) {
        currentNode = walker.nextNode();
        continue;
      }
      const normalizedText = normalizeText(rawText);
      if (normalizedText.length < MIN_TEXT_LENGTH || normalizedText.length > MAX_TEXT_LENGTH) {
        currentNode = walker.nextNode();
        continue;
      }
      const candidateElement = toMeaningfulAncestor(textNode);
      if (!candidateElement || !isCandidateElementValid(candidateElement)) {
        currentNode = walker.nextNode();
        continue;
      }
      if (isLikelyHelperText(normalizedText, candidateElement)) {
        currentNode = walker.nextNode();
        continue;
      }
      if (hasSeenTextForElement(seenByElement, candidateElement, normalizedText)) {
        currentNode = walker.nextNode();
        continue;
      }
      candidates.push({
        textNode,
        element: candidateElement,
        text: rawText,
        normalizedText,
        tagName: candidateElement.tagName.toLowerCase(),
        textLength: normalizedText.length
      });
      currentNode = walker.nextNode();
    }
    return candidates;
  };

  // src/content/autofill/layer2/layer2-lca.ts
  var buildAncestorChain = (element) => {
    const chain = [];
    let current = element;
    while (current) {
      chain.push(current);
      current = current.parentElement;
    }
    return chain;
  };
  var findLowestCommonAncestor = (left, right) => {
    if (left === right) {
      return left;
    }
    const rightAncestors = new Set(buildAncestorChain(right));
    for (const ancestor of buildAncestorChain(left)) {
      if (rightAncestors.has(ancestor)) {
        return ancestor;
      }
    }
    return null;
  };
  var getDistanceToAncestor = (element, ancestor) => {
    if (element === ancestor) {
      return 0;
    }
    let distance = 0;
    let current = element;
    while (current && current !== ancestor) {
      current = current.parentElement;
      distance += 1;
    }
    return current === ancestor ? distance : Number.POSITIVE_INFINITY;
  };
  var getLcaDistance = (left, right) => {
    const lca = findLowestCommonAncestor(left, right);
    if (!lca) {
      return Number.POSITIVE_INFINITY;
    }
    const leftDistance = getDistanceToAncestor(left, lca);
    const rightDistance = getDistanceToAncestor(right, lca);
    if (!Number.isFinite(leftDistance) || !Number.isFinite(rightDistance)) {
      return Number.POSITIVE_INFINITY;
    }
    return leftDistance + rightDistance;
  };
  var appearsBeforeInDom = (left, right) => {
    const position = left.compareDocumentPosition(right);
    return (position & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
  };
  var getAncestorElements = (element) => {
    const ancestors = [];
    let current = element;
    while (current) {
      ancestors.push(current);
      current = current.parentElement;
    }
    return ancestors;
  };

  // src/content/autofill/layer2/layer2-scoring.ts
  var LAYER2_ACCEPT_THRESHOLD = 0.8;
  var LAYER2_REVIEW_THRESHOLD = 0.5;
  var MARGIN_DIVISOR2 = 0.35;
  var STRONG_LOCAL_MATCH_BONUS = 0.08;
  var CONFIDENCE_ABS_WEIGHT = 0.65;
  var CONFIDENCE_MARGIN_WEIGHT = 0.35;
  var MIN_LAYER2_SIGNAL_SCORE = 0.2;
  var LOW_LEXICAL_STRENGTH = 0.85;
  var LOW_LEXICAL_MARGIN = 0.12;
  var LEXICAL_AMBIGUITY_PENALTY = 0.12;
  var MIN_RESOLVE_LIFT = 0.12;
  var FAR_OUT_OF_GROUP_DISTANCE = 12;
  var FAR_OUT_OF_GROUP_CONFIDENCE_CAP = 0.6;
  var GROUP_CANDIDATE_DENSITY_DIVISOR = 5;
  var GROUP_SMALL_CONTROL_THRESHOLD = 8;
  var GROUP_LARGE_CONTROL_THRESHOLD = 24;
  var GROUP_SMALL_CONTROL_BONUS = 0.5;
  var GROUP_LARGE_CONTROL_PENALTY = 0.8;
  var GROUP_SMALL_SUBTREE_THRESHOLD = 2;
  var GROUP_LARGE_SUBTREE_THRESHOLD = 350;
  var GROUP_SMALL_SUBTREE_PENALTY = 0.4;
  var GROUP_LARGE_SUBTREE_PENALTY = 1;
  var GROUP_SEMANTIC_TAG_BONUS = 0.45;
  var GROUP_REPEATED_SIBLING_BONUS = 0.6;
  var GROUP_DEPTH_PENALTY_STEP = 0.08;
  var REPEATED_SHAPE_CLASS_SIMILARITY = 0.5;
  var REPEATED_SHAPE_MIN_MATCHES = 1;
  var OUT_OF_GROUP_DIRECTION_DISTANCE_CUTOFF = 6;
  var MAX_SAME_GROUP_DISTANCE = 7;
  var STRUCTURE_CONTAINS_FIELD_PENALTY = 0.08;
  var STRUCTURE_CONTROL_PENALTY_STEP = 0.04;
  var STRUCTURE_CONTROL_PENALTY_MAX = 0.18;
  var STRONG_LOCAL_MAX_DISTANCE = 4;
  var STRONG_LOCAL_MIN_LEXICAL_SCORE = 0.6;
  var OUT_OF_GROUP_RESOLVE_CAP = 0.79;
  var SEMANTIC_GROUP_TAGS = /* @__PURE__ */ new Set([
    "fieldset",
    "section",
    "article",
    "li",
    "tr"
  ]);
  var getControlCount = (element) => element.querySelectorAll(DISCOVERABLE_FIELD_SELECTOR).length;
  var getSubtreeSize = (element) => element.querySelectorAll("*").length;
  var getCandidateCountInGroup = (group, candidates) => candidates.filter((candidate) => group.contains(candidate.element)).length;
  var toClassTokenSet = (element) => new Set(Array.from(element.classList).filter(Boolean));
  var getClassSimilarity = (left, right) => {
    if (left.size === 0 && right.size === 0) {
      return 1;
    }
    if (left.size === 0 || right.size === 0) {
      return 0;
    }
    let intersection = 0;
    for (const token of left) {
      if (right.has(token)) {
        intersection += 1;
      }
    }
    const union = left.size + right.size - intersection;
    return union > 0 ? intersection / union : 0;
  };
  var hasRepeatedSiblingShape = (element) => {
    const parent = element.parentElement;
    if (!parent) {
      return false;
    }
    const baseClassTokens = toClassTokenSet(element);
    const similarSiblings = Array.from(parent.children).filter((child) => {
      if (!(child instanceof HTMLElement)) {
        return false;
      }
      if (child === element || child.tagName !== element.tagName) {
        return false;
      }
      const siblingClassTokens = toClassTokenSet(child);
      const classSimilarity = getClassSimilarity(baseClassTokens, siblingClassTokens);
      return classSimilarity >= REPEATED_SHAPE_CLASS_SIMILARITY;
    });
    return similarSiblings.length >= REPEATED_SHAPE_MIN_MATCHES;
  };
  var isCandidateGroup = (ancestor, candidates) => {
    const candidateCount = getCandidateCountInGroup(ancestor, candidates);
    const controlCount = getControlCount(ancestor);
    return candidateCount > 0 && controlCount > 0;
  };
  var resolveGroupRoot = (fieldElement, candidates) => {
    const ancestors = getAncestorElements(fieldElement);
    let bestGroup = null;
    let bestScore = Number.NEGATIVE_INFINITY;
    for (const [depth, ancestor] of ancestors.entries()) {
      if (!isCandidateGroup(ancestor, candidates)) {
        continue;
      }
      const candidateCount = getCandidateCountInGroup(ancestor, candidates);
      const controlCount = getControlCount(ancestor);
      const subtreeSize = getSubtreeSize(ancestor);
      if (controlCount === 1 && candidateCount > 0 && subtreeSize >= GROUP_SMALL_SUBTREE_THRESHOLD && subtreeSize <= GROUP_LARGE_SUBTREE_THRESHOLD) {
        return ancestor;
      }
      let score = 0;
      score += 1;
      score += clamp(candidateCount / GROUP_CANDIDATE_DENSITY_DIVISOR, 0, 1);
      if (controlCount <= GROUP_SMALL_CONTROL_THRESHOLD) {
        score += GROUP_SMALL_CONTROL_BONUS;
      } else if (controlCount > GROUP_LARGE_CONTROL_THRESHOLD) {
        score -= GROUP_LARGE_CONTROL_PENALTY;
      }
      if (subtreeSize < GROUP_SMALL_SUBTREE_THRESHOLD) {
        score -= GROUP_SMALL_SUBTREE_PENALTY;
      } else if (subtreeSize > GROUP_LARGE_SUBTREE_THRESHOLD) {
        score -= GROUP_LARGE_SUBTREE_PENALTY;
      }
      if (SEMANTIC_GROUP_TAGS.has(ancestor.tagName.toLowerCase())) {
        score += GROUP_SEMANTIC_TAG_BONUS;
      }
      if (hasRepeatedSiblingShape(ancestor)) {
        score += GROUP_REPEATED_SIBLING_BONUS;
      }
      score -= depth * GROUP_DEPTH_PENALTY_STEP;
      if (score > bestScore) {
        bestScore = score;
        bestGroup = ancestor;
      }
    }
    return bestGroup ?? fieldElement.parentElement ?? fieldElement;
  };
  var getDistanceWeight = (distance) => {
    if (!Number.isFinite(distance)) {
      return 0;
    }
    return 1 / (1 + distance);
  };
  var getStructurePenalty = (candidateElement, fieldElement) => {
    let penalty = 0;
    const nestedControlCount = getControlCount(candidateElement);
    if (candidateElement.contains(fieldElement)) {
      penalty += STRUCTURE_CONTAINS_FIELD_PENALTY;
    }
    if (nestedControlCount > 1) {
      penalty += Math.min(
        STRUCTURE_CONTROL_PENALTY_MAX,
        (nestedControlCount - 1) * STRUCTURE_CONTROL_PENALTY_STEP
      );
    }
    return penalty;
  };
  var selectCandidatesForGroup = (groupRoot, candidates) => {
    const inGroup = [];
    const outGroup = [];
    for (const candidate of candidates) {
      if (groupRoot.contains(candidate.element)) {
        inGroup.push(candidate);
      } else {
        outGroup.push(candidate);
      }
    }
    return inGroup.length > 0 ? [...inGroup, ...outGroup] : outGroup;
  };
  var getNoisePenalty = (textLength) => {
    if (textLength > 140) {
      return 0.2;
    }
    if (textLength > 100) {
      return 0.1;
    }
    return 0;
  };
  var getStatusForConfidence2 = (confidence, hasMatch) => {
    if (!hasMatch) {
      return "unresolved" /* Unresolved */;
    }
    if (confidence >= LAYER2_ACCEPT_THRESHOLD) {
      return "resolved" /* Resolved */;
    }
    if (confidence >= LAYER2_REVIEW_THRESHOLD) {
      return "ambiguous" /* Ambiguous */;
    }
    return "unresolved" /* Unresolved */;
  };
  var buildMatch = (fieldResult, candidate, groupRoot, layer2Scores, combinedScores, confidence) => {
    const { topType, topScore } = getTopTwoScoredTypes(combinedScores);
    const lexicalTop = getTopTwoScoredTypes(layer2Scores);
    const distance = getLcaDistance(fieldResult.element, candidate.element);
    const sameGroup = groupRoot.contains(candidate.element);
    const hasMatch = topType !== "unknown" /* Unknown */ && topScore > 0;
    return {
      fieldId: fieldResult.fieldId,
      fieldType: hasMatch ? topType : "unknown" /* Unknown */,
      confidence,
      status: getStatusForConfidence2(confidence, hasMatch),
      typeScores: combinedScores,
      match: {
        fieldId: fieldResult.fieldId,
        candidateText: candidate.text,
        lcaDistance: distance,
        sameGroup,
        lexicalTopType: lexicalTop.topType,
        lexicalScore: lexicalTop.topScore,
        combinedScore: topScore
      }
    };
  };
  var scoreCandidate = (fieldResult, candidate, groupRoot) => {
    const lexicalMatches = getMatchesFromText(candidate.text);
    if (lexicalMatches.length === 0) {
      return null;
    }
    const distance = getLcaDistance(fieldResult.element, candidate.element);
    if (!Number.isFinite(distance)) {
      return null;
    }
    const sameGroup = groupRoot.contains(candidate.element);
    const isBeforeField = appearsBeforeInDom(candidate.element, fieldResult.element);
    if (!sameGroup && !isBeforeField && distance > OUT_OF_GROUP_DIRECTION_DISTANCE_CUTOFF) {
      return null;
    }
    if (sameGroup && distance > MAX_SAME_GROUP_DISTANCE) {
      return null;
    }
    const distanceWeight = getDistanceWeight(distance);
    const groupWeight = sameGroup ? 0.35 : 0;
    const directionWeight = isBeforeField ? 0.1 : 0;
    const noisePenalty = getNoisePenalty(candidate.textLength);
    const structurePenalty = getStructurePenalty(
      candidate.element,
      fieldResult.element
    );
    const proximityWeight = Math.max(
      0,
      distanceWeight + groupWeight + directionWeight - noisePenalty - structurePenalty
    );
    if (proximityWeight <= 0) {
      return null;
    }
    const layer2Scores = createBaseTypeScores();
    for (const lexicalMatch of lexicalMatches) {
      layer2Scores[lexicalMatch.fieldType] += lexicalMatch.score * proximityWeight;
    }
    const lexicalTop = getTopTwoScoredTypes(layer2Scores);
    if (lexicalTop.topScore < MIN_LAYER2_SIGNAL_SCORE) {
      return null;
    }
    const combinedScores = createBaseTypeScores();
    for (const fieldType of FIELD_TYPES) {
      combinedScores[fieldType] = (fieldResult.typeScores[fieldType] ?? 0) + (layer2Scores[fieldType] ?? 0);
    }
    const { topType, topScore, secondScore } = getTopTwoScoredTypes(combinedScores);
    const hasMatch = topType !== "unknown" /* Unknown */ && topScore > 0;
    const absScore = clamp(topScore, 0, 1);
    const marginScore = clamp((topScore - secondScore) / MARGIN_DIVISOR2, 0, 1);
    let confidence = CONFIDENCE_ABS_WEIGHT * absScore + CONFIDENCE_MARGIN_WEIGHT * marginScore;
    if (!sameGroup) {
      confidence = Math.min(confidence, OUT_OF_GROUP_RESOLVE_CAP);
    }
    if (!sameGroup && distance >= FAR_OUT_OF_GROUP_DISTANCE) {
      confidence = Math.min(confidence, FAR_OUT_OF_GROUP_CONFIDENCE_CAP);
    }
    const strongLocalMatch = sameGroup && distance <= STRONG_LOCAL_MAX_DISTANCE && lexicalTop.topType !== "unknown" /* Unknown */ && lexicalTop.topScore >= STRONG_LOCAL_MIN_LEXICAL_SCORE;
    if (strongLocalMatch) {
      confidence = Math.min(1, confidence + STRONG_LOCAL_MATCH_BONUS);
    }
    if (!hasMatch) {
      confidence = 0;
    } else {
      const lexicalMargin = lexicalTop.topScore - lexicalTop.secondScore;
      if (lexicalTop.topScore < LOW_LEXICAL_STRENGTH && lexicalMargin < LOW_LEXICAL_MARGIN) {
        confidence = Math.max(0, confidence - LEXICAL_AMBIGUITY_PENALTY);
      }
      const currentTopScore = fieldResult.typeScores[topType] ?? 0;
      const resolveLift = topScore - currentTopScore;
      if (confidence >= LAYER2_ACCEPT_THRESHOLD && resolveLift < MIN_RESOLVE_LIFT) {
        confidence = Math.min(confidence, LAYER2_ACCEPT_THRESHOLD - 0.01);
      }
    }
    confidence = Number(clamp(confidence, 0, 1).toFixed(4));
    return buildMatch(
      fieldResult,
      candidate,
      groupRoot,
      layer2Scores,
      combinedScores,
      confidence
    );
  };
  var shouldReplaceDecision = (current, next) => {
    if (!current) {
      return true;
    }
    if (next.confidence !== current.confidence) {
      return next.confidence > current.confidence;
    }
    const nextScore = next.match?.combinedScore ?? 0;
    const currentScore = current.match?.combinedScore ?? 0;
    if (nextScore !== currentScore) {
      return nextScore > currentScore;
    }
    const nextDistance = next.match?.lcaDistance ?? Number.POSITIVE_INFINITY;
    const currentDistance = current.match?.lcaDistance ?? Number.POSITIVE_INFINITY;
    if (nextDistance !== currentDistance) {
      return nextDistance < currentDistance;
    }
    const nextLexicalScore = next.match?.lexicalScore ?? 0;
    const currentLexicalScore = current.match?.lexicalScore ?? 0;
    if (nextLexicalScore !== currentLexicalScore) {
      return nextLexicalScore > currentLexicalScore;
    }
    const nextTextLength = next.match?.candidateText.length ?? Number.POSITIVE_INFINITY;
    const currentTextLength = current.match?.candidateText.length ?? Number.POSITIVE_INFINITY;
    return nextTextLength < currentTextLength;
  };
  var evaluateFieldWithLayer2 = (fieldResult, candidates) => {
    if (fieldResult.status === "resolved" /* Resolved */) {
      return null;
    }
    if (!(fieldResult.element instanceof HTMLElement)) {
      return null;
    }
    const groupRoot = resolveGroupRoot(fieldResult.element, candidates);
    const scopedCandidates = selectCandidatesForGroup(groupRoot, candidates);
    let bestDecision = null;
    for (const candidate of scopedCandidates) {
      const decision = scoreCandidate(fieldResult, candidate, groupRoot);
      if (!decision) {
        continue;
      }
      if (shouldReplaceDecision(bestDecision, decision)) {
        bestDecision = decision;
      }
    }
    return bestDecision;
  };

  // src/content/autofill/layer2/layer2.ts
  var LAYER2_RESOLUTION = "layer2";
  var hasLayer2TargetStatus = (result) => result.status === "ambiguous" /* Ambiguous */ || result.status === "unresolved" /* Unresolved */;
  var shouldAcceptLayer2Resolution = (result, fieldType) => {
    if (result.controlKind !== "file" /* File */) {
      return true;
    }
    return fieldType === "resume" /* Resume */;
  };
  var refineResultsWithLayer2 = (results, options = {}) => {
    const candidates = collectLabelLikeCandidates(document);
    const refined = results.map((result) => {
      if (!hasLayer2TargetStatus(result)) {
        return result;
      }
      const decision = evaluateFieldWithLayer2(result, candidates);
      if (!decision) {
        return result;
      }
      if (decision.status !== "resolved" /* Resolved */) {
        return {
          ...result,
          layer2Match: decision.match ?? result.layer2Match
        };
      }
      if (!shouldAcceptLayer2Resolution(result, decision.fieldType)) {
        return {
          ...result,
          layer2Match: decision.match ?? result.layer2Match
        };
      }
      return {
        ...result,
        fieldType: decision.fieldType,
        confidence: decision.confidence,
        status: decision.status,
        typeScores: decision.typeScores,
        layer2Match: decision.match,
        resolutionLayer: LAYER2_RESOLUTION
      };
    });
    if (options.debug) {
      const promoted = refined.filter(
        (result) => result.resolutionLayer === LAYER2_RESOLUTION
      );
      console.group("[Layer2 Refinement]");
      console.info("Candidate text nodes:", candidates.length);
      console.info("Promoted fields:", promoted.length);
      for (const field of promoted) {
        console.info(field.fieldId, {
          fieldType: field.fieldType,
          confidence: field.confidence,
          match: field.layer2Match
        });
      }
      console.groupEnd();
    }
    return refined;
  };

  // src/shared/field-labels.ts
  var FIELD_TYPE_LABELS = {
    ["first_name" /* FirstName */]: "First Name",
    ["last_name" /* LastName */]: "Last Name",
    ["full_name" /* FullName */]: "Full Name",
    ["email" /* Email */]: "Email",
    ["phone" /* Phone */]: "Phone",
    ["address_line1" /* AddressLine1 */]: "Address Line 1",
    ["address_line2" /* AddressLine2 */]: "Address Line 2",
    ["city" /* City */]: "City",
    ["state" /* State */]: "State",
    ["postal_code" /* PostalCode */]: "Postal Code",
    ["country" /* Country */]: "Country",
    ["gender" /* Gender */]: "Gender",
    ["company" /* Company */]: "Company",
    ["job_title" /* JobTitle */]: "Job Title",
    ["total_experience" /* TotalExperience */]: "Total Experience",
    ["relevant_experience" /* RelevantExperience */]: "Relevant Experience",
    ["skills" /* Skills */]: "Skills",
    ["tech_stack" /* TechStack */]: "Tech Stack",
    ["scale_experience" /* ScaleExperience */]: "Scale Experience",
    ["professional_summary" /* ProfessionalSummary */]: "Professional Summary",
    ["project_summary" /* ProjectSummary */]: "Project Summary",
    ["highest_education" /* HighestEducation */]: "Highest Education",
    ["graduation_year" /* GraduationYear */]: "Graduation Year",
    ["date_of_birth" /* DateOfBirth */]: "Date Of Birth",
    ["current_ctc" /* CurrentCtc */]: "Current CTC",
    ["expected_ctc" /* ExpectedCtc */]: "Expected CTC",
    ["notice_period" /* NoticePeriod */]: "Notice Period",
    ["resume" /* Resume */]: "Resume",
    ["linkedin" /* LinkedIn */]: "LinkedIn",
    ["github" /* GitHub */]: "GitHub",
    ["leetcode" /* LeetCode */]: "LeetCode",
    ["website" /* Website */]: "Website",
    ["unknown" /* Unknown */]: "Unknown"
  };
  var getFieldTypeLabel = (fieldType) => FIELD_TYPE_LABELS[fieldType] ?? "Unknown";

  // scripts/autofill-eval-entry.ts
  var countByStatus = (results, status) => results.filter((result) => result.status === status).length;
  var describeElement = (element) => {
    const base = {
      tagName: element.tagName.toLowerCase(),
      inputType: element instanceof HTMLInputElement ? element.type.toLowerCase() : void 0,
      role: element.getAttribute("role") ?? void 0,
      nameAttr: element.getAttribute("name") ?? void 0,
      idAttr: element.getAttribute("id") ?? void 0,
      placeholder: element.getAttribute("placeholder") ?? void 0,
      ariaLabel: element.getAttribute("aria-label") ?? void 0,
      autocomplete: element.getAttribute("autocomplete") ?? void 0
    };
    return base;
  };
  window.__runAutofillEval = () => {
    const discoveredFields = discoverFormFields(document);
    const layer1Results = discoveredFields.map((field) => evaluateFieldWithLayer1(field));
    const refinedResults = refineResultsWithLayer2(layer1Results, { debug: false });
    const discoveredById = new Map(discoveredFields.map((field) => [field.id, field]));
    const resolved = countByStatus(refinedResults, "resolved" /* Resolved */);
    const ambiguous = countByStatus(refinedResults, "ambiguous" /* Ambiguous */);
    const unresolved = countByStatus(refinedResults, "unresolved" /* Unresolved */);
    const layer2Resolved = refinedResults.filter(
      (result) => result.status === "resolved" /* Resolved */ && result.resolutionLayer === "layer2"
    ).length;
    const snapshots = refinedResults.map((result) => ({
      elementInfo: describeElement(
        discoveredById.get(result.fieldId)?.element ?? result.element
      ),
      fieldId: result.fieldId,
      fieldName: getFieldTypeLabel(result.fieldType),
      controlKind: result.controlKind,
      fieldType: result.fieldType,
      confidence: result.confidence,
      status: result.status,
      fillable: result.fillable,
      skipReason: result.skipReason,
      evidence: result.evidence,
      resolutionLayer: result.resolutionLayer,
      layer2Match: result.layer2Match ? {
        candidateText: result.layer2Match.candidateText,
        lcaDistance: result.layer2Match.lcaDistance,
        sameGroup: result.layer2Match.sameGroup,
        lexicalTopType: result.layer2Match.lexicalTopType,
        lexicalScore: result.layer2Match.lexicalScore,
        combinedScore: result.layer2Match.combinedScore
      } : void 0
    }));
    return {
      totalDiscovered: discoveredFields.length,
      resolved,
      ambiguous,
      unresolved,
      layer2Resolved,
      results: snapshots
    };
  };
})();
