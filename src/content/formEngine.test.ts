import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  detectFillableFields,
  detectUploadInputs,
  fillDetectedFields,
  promptResumeUpload
} from './formEngine';

describe('detectFillableFields', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('detects supported and fillable controls including combobox/listbox', () => {
    document.body.innerHTML = `
      <input id="text" type="text" />
      <input id="hidden" type="hidden" />
      <input id="file" type="file" />
      <input id="disabled" type="text" disabled />
      <textarea id="area"></textarea>
      <select id="country"><option value="us">US</option></select>
      <div id="editable" contenteditable="true"></div>
      <div id="textbox" role="textbox"></div>
      <div id="combo" role="combobox"></div>
      <div id="list" role="listbox"></div>
      <input id="display-none" type="text" style="display:none" />
    `;

    const fields = detectFillableFields();
    const ids = fields.map((field) => (field.element as HTMLElement).id);

    expect(ids).toContain('text');
    expect(ids).toContain('area');
    expect(ids).toContain('country');
    expect(ids).toContain('editable');
    expect(ids).toContain('textbox');
    expect(ids).toContain('combo');
    expect(ids).toContain('list');

    expect(ids).not.toContain('hidden');
    expect(ids).not.toContain('file');
    expect(ids).not.toContain('disabled');
    expect(ids).not.toContain('display-none');
  });
});

describe('fillDetectedFields', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('fills deterministic values in test mode', () => {
    document.body.innerHTML = `
      <input id="text" type="text" />
      <input id="number" type="number" />
      <input id="date" type="date" />
      <input id="datetime" type="datetime-local" />
      <input id="month" type="month" />
      <input id="time" type="time" />
      <input id="week" type="week" />
      <input id="color" type="color" />
      <input id="range" type="range" min="0" max="10" />
      <input id="checkbox" type="checkbox" />
      <input id="r1" type="radio" name="group1" />
      <input id="r2" type="radio" name="group1" />
      <textarea id="area"></textarea>
      <select id="country">
        <option value="">Select...</option>
        <option value="us">United States</option>
      </select>
      <div id="editable" contenteditable="true"></div>
    `;

    const result = fillDetectedFields(document, { mode: 'test' });

    expect((document.getElementById('text') as HTMLInputElement).value).toBe('test');
    expect((document.getElementById('number') as HTMLInputElement).value).toBe('1');
    expect((document.getElementById('date') as HTMLInputElement).value).toBe('2026-01-01');
    expect((document.getElementById('datetime') as HTMLInputElement).value).toBe(
      '2026-01-01T10:00'
    );
    expect((document.getElementById('month') as HTMLInputElement).value).toBe('2026-01');
    expect((document.getElementById('time') as HTMLInputElement).value).toBe('10:00');
    expect((document.getElementById('week') as HTMLInputElement).value).toBe('2026-W01');
    expect((document.getElementById('color') as HTMLInputElement).value).toBe('#000000');
    expect((document.getElementById('range') as HTMLInputElement).value).toBe('5');
    expect((document.getElementById('checkbox') as HTMLInputElement).checked).toBe(true);
    expect((document.getElementById('r1') as HTMLInputElement).checked).toBe(true);
    expect((document.getElementById('r2') as HTMLInputElement).checked).toBe(false);
    expect((document.getElementById('area') as HTMLTextAreaElement).value).toBe('test');
    expect((document.getElementById('country') as HTMLSelectElement).value).toBe('us');
    expect((document.getElementById('editable') as HTMLElement).textContent).toBe('test');

    expect(result.errors).toBe(0);
    expect(result.filled).toBeGreaterThan(0);
  });

  it('fills personalized values in profile mode', () => {
    document.body.innerHTML = `
      <label for="full-name">Full Name</label>
      <input id="full-name" type="text" />
      <input name="first_name" type="text" />
      <input name="middle_name" type="text" />
      <input name="last_name" type="text" />
      <input name="email" type="email" />
      <input name="phone" type="tel" />
      <input name="total_experience_years" type="number" />
      <input name="expected_ctc" type="number" />
      <input name="current_ctc" type="number" />
      <input name="current_location" type="text" />
      <input name="current_company" type="text" />
      <input name="current_designation" type="text" />
      <input name="highest_qualification" type="text" />
      <input name="degree" type="text" />
      <input name="college_name" type="text" />
      <input name="graduation_year" type="number" />
      <input name="cgpa" type="text" />
      <textarea name="professional_summary"></textarea>
      <select id="gender">
        <option value="">Select...</option>
        <option value="Female">Female</option>
        <option value="Male">Male</option>
      </select>
      <textarea name="skills"></textarea>
    `;

    fillDetectedFields(document, { mode: 'profile' });

    const fullName = document.getElementById('full-name') as HTMLInputElement;
    const firstName = document.querySelector('input[name="first_name"]') as HTMLInputElement;
    const middleName = document.querySelector('input[name="middle_name"]') as HTMLInputElement;
    const lastName = document.querySelector('input[name="last_name"]') as HTMLInputElement;
    const email = document.querySelector('input[name="email"]') as HTMLInputElement;
    const phone = document.querySelector('input[name="phone"]') as HTMLInputElement;
    const experienceYears = document.querySelector(
      'input[name="total_experience_years"]'
    ) as HTMLInputElement;
    const expected = document.querySelector('input[name="expected_ctc"]') as HTMLInputElement;
    const current = document.querySelector('input[name="current_ctc"]') as HTMLInputElement;
    const location = document.querySelector('input[name="current_location"]') as HTMLInputElement;
    const currentCompany = document.querySelector(
      'input[name="current_company"]'
    ) as HTMLInputElement;
    const currentDesignation = document.querySelector(
      'input[name="current_designation"]'
    ) as HTMLInputElement;
    const highestQualification = document.querySelector(
      'input[name="highest_qualification"]'
    ) as HTMLInputElement;
    const degree = document.querySelector('input[name="degree"]') as HTMLInputElement;
    const college = document.querySelector('input[name="college_name"]') as HTMLInputElement;
    const graduationYear = document.querySelector(
      'input[name="graduation_year"]'
    ) as HTMLInputElement;
    const cgpa = document.querySelector('input[name="cgpa"]') as HTMLInputElement;
    const summary = document.querySelector(
      'textarea[name="professional_summary"]'
    ) as HTMLTextAreaElement;
    const gender = document.getElementById('gender') as HTMLSelectElement;
    const skills = document.querySelector('textarea[name="skills"]') as HTMLTextAreaElement;

    expect(fullName.value).toBe('Abdus Samad');
    expect(firstName.value).toBe('Abdus');
    expect(middleName.value).toBe('');
    expect(lastName.value).toBe('Samad');
    expect(email.value).toBe('samad.abdus3535@gmail.com');
    expect(phone.value).toBe('+919654405340');
    expect(experienceYears.value).toBe('5');
    expect(expected.value).toBe('3200000');
    expect(current.value).toBe('2300000');
    expect(location.value).toBe('Delhi');
    expect(currentCompany.value).toBe('Caw Studios');
    expect(currentDesignation.value).toBe('Full Stack Developer');
    expect(highestQualification.value).toBe('Bachelor Of Computer Applications');
    expect(degree.value).toBe('BCA');
    expect(college.value).toBe('Ambedkar Institute of Technology');
    expect(graduationYear.value).toBe('2023');
    expect(cgpa.value).toBe('8.7');
    expect(summary.value).toContain('Full-stack developer');
    expect(gender.value).toBe('Male');
    expect(skills.value).toContain('TypeScript');
  });

  it('handles complex job-application fields without bad mappings', () => {
    document.body.innerHTML = `
      <label for="mobilePhone.countryCode">Mobile Phone</label>
      <select name="mobilePhone.countryCode" id="mobilePhone.countryCode">
        <option value=""></option>
        <option value="+1">+1</option>
        <option value="+91">+91</option>
      </select>
      <span id="readonly-country-display" role="textbox" aria-readonly="true">Argentina</span>
      <input type="text" id="mobilePhone.number" name="mobilePhone.number" />

      <label for="workExperience">Experience (in years)</label>
      <input type="text" id="workExperience" name="workExperience.years" />
      <select class="workExperienceMonths" name="workExperience.months">
        <option value="0">0</option>
        <option value="1">1</option>
        <option value="2">2</option>
        <option value="3">3</option>
        <option value="4">4</option>
        <option value="5">5</option>
        <option value="6">6</option>
      </select>

      <label for="officialNotice">Official Notice Period (in days)</label>
      <input type="number" id="officialNotice" name="standardFields.notice.answer" />

      <label for="servingNp">Serving NP</label>
      <select id="servingNp" name="standardFields.servingNp.answer">
        <option value="">Select an option</option>
        <option value="yes">Yes</option>
        <option value="no">No</option>
      </select>

      <label for="lwdField">LWD (dd/mm/yyyy). If not serving NP, input NA</label>
      <input type="text" id="lwdField" name="standardFields.lwd.answer" />

      <label for="sourceField">Through which platform did you learn about this job</label>
      <input type="text" id="sourceField" name="standardFields.source.answer" />

      <label for="githubField">Github/Portfolio Link</label>
      <input type="text" id="githubField" name="standardFields.github.answer" />

      <label for="linkedinField">LinkedIn Profile</label>
      <input type="text" id="linkedinField" name="standardFields.linkedin.answer" />

      <label for="portfolioField">Portfolio Website</label>
      <input type="text" id="portfolioField" name="standardFields.portfolio.answer" />

      <label for="projectsField">Project Links</label>
      <textarea id="projectsField" name="standardFields.projects.answer"></textarea>

      <label for="leetcodeField">Leetcode Profile</label>
      <input type="text" id="leetcodeField" name="standardFields.leetcode.answer" />

      <label for="captcha">Captcha</label>
      <input type="text" id="captcha" name="captcha" />
    `;

    fillDetectedFields(document, { mode: 'profile' });

    const countryCode = document.getElementById(
      'mobilePhone.countryCode'
    ) as HTMLSelectElement;
    const readonlyDisplay = document.getElementById(
      'readonly-country-display'
    ) as HTMLElement;
    const mobileNumber = document.getElementById(
      'mobilePhone.number'
    ) as HTMLInputElement;
    const expYears = document.getElementById('workExperience') as HTMLInputElement;
    const expMonths = document.querySelector(
      'select[name="workExperience.months"]'
    ) as HTMLSelectElement;
    const noticeDays = document.getElementById('officialNotice') as HTMLInputElement;
    const servingNp = document.getElementById('servingNp') as HTMLSelectElement;
    const lwdField = document.getElementById('lwdField') as HTMLInputElement;
    const source = document.getElementById('sourceField') as HTMLInputElement;
    const githubField = document.getElementById('githubField') as HTMLInputElement;
    const linkedinField = document.getElementById('linkedinField') as HTMLInputElement;
    const portfolioField = document.getElementById('portfolioField') as HTMLInputElement;
    const projectsField = document.getElementById('projectsField') as HTMLTextAreaElement;
    const leetcodeField = document.getElementById('leetcodeField') as HTMLInputElement;
    const captcha = document.getElementById('captcha') as HTMLInputElement;

    expect(countryCode.value).toBe('+91');
    expect(readonlyDisplay.textContent).toBe('Argentina');
    expect(mobileNumber.value).toBe('9654405340');
    expect(expYears.value).toBe('5');
    expect(expMonths.value).toBe('6');
    expect(noticeDays.value).toBe('60');
    expect(servingNp.value).toBe('yes');
    expect(lwdField.value).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
    expect(source.value).toBe('LinkedIn');
    expect(githubField.value).toBe('https://github.com/asamad35');
    expect(linkedinField.value).toBe('https://www.linkedin.com/in/asamad35/');
    expect(portfolioField.value).toBe('https://asamad.vercel.app/');
    expect(projectsField.value).toContain('https://doodleit.vercel.app/');
    expect(leetcodeField.value).toBe('https://leetcode.com/user5730HH/');
    expect(captcha.value).toBe('');
  });

  it('maps nearby labels for rich-text salary and notice fields', () => {
    document.body.innerHTML = `
      <div class="form-group">
        <label>Current CTC</label>
        <div class="editor-wrapper">
          <div id="currentCtcEditor" contenteditable="true"></div>
        </div>
      </div>
      <div class="form-group">
        <label>Expected CTC</label>
        <div class="editor-wrapper">
          <div id="expectedCtcEditor" contenteditable="true"></div>
        </div>
      </div>
      <div class="form-group">
        <label>Notice Period</label>
        <div class="editor-wrapper">
          <div id="noticeEditor" contenteditable="true"></div>
        </div>
      </div>
    `;

    fillDetectedFields(document, { mode: 'profile' });

    const currentCtcEditor = document.getElementById('currentCtcEditor') as HTMLElement;
    const expectedCtcEditor = document.getElementById('expectedCtcEditor') as HTMLElement;
    const noticeEditor = document.getElementById('noticeEditor') as HTMLElement;

    expect(currentCtcEditor.textContent).toBe('2300000');
    expect(expectedCtcEditor.textContent).toBe('3200000');
    expect(noticeEditor.textContent).toBe('2 months');
  });

  it('skips unknown textareas in profile mode instead of filling test', () => {
    document.body.innerHTML = `
      <label for="custom-note">Custom note</label>
      <textarea id="custom-note" name="customNote"></textarea>
    `;

    fillDetectedFields(document, { mode: 'profile' });

    const textarea = document.getElementById('custom-note') as HTMLTextAreaElement;
    expect(textarea.value).toBe('');
  });

  it('dispatches input and change events after setting value', () => {
    const input = document.createElement('input');
    input.type = 'text';
    document.body.append(input);

    const onInput = vi.fn();
    const onChange = vi.fn();
    input.addEventListener('input', onInput);
    input.addEventListener('change', onChange);

    fillDetectedFields(document, { mode: 'test' });

    expect(input.value).toBe('test');
    expect(onInput).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('detects and prompts visible file inputs when requested', () => {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    document.body.append(fileInput);

    const clickSpy = vi.spyOn(fileInput, 'click');

    expect(detectUploadInputs().length).toBe(1);
    expect(promptResumeUpload()).toBe(true);
    expect(clickSpy).toHaveBeenCalledTimes(1);

    const summary = fillDetectedFields(document, {
      mode: 'profile',
      promptResumeUpload: true
    });

    expect(summary.fileInputsDetected).toBe(1);
    expect(summary.fileInputPrompted).toBe(true);
  });
});
