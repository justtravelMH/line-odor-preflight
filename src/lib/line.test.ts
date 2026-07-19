import crypto from 'node:crypto';
import {expect, it} from 'vitest';
import {baselineProgressFlex, parsePostback, validLineSignature} from './line';

it('validates signature', () => {
  const signature = crypto.createHmac('sha256', 'secret').update('{}').digest('base64');
  expect(validLineSignature('{}', signature, 'secret')).toBe(true);
  expect(validLineSignature('{}', 'bad', 'secret')).toBe(false);
});

it('parses versioned postback', () => {
  expect(parsePostback('v=1&action=record_odor&level=2')).toEqual({
    v: '1', action: 'record_odor', level: '2', type: undefined, recordId: undefined,
  });
});

it('builds a typed baseline Flex payload', () => {
  expect(baselineProgressFlex({state: 'BUILDING_BASELINE', baselineProgress: {current: 2, required: 3}}))
    .toMatchInlineSnapshot(`
      {
        "altText": "日常基準進度 2/3",
        "contents": {
          "body": {
            "contents": [
              {
                "size": "xl",
                "text": "已記下這次味道",
                "type": "text",
                "weight": "bold",
                "wrap": true,
              },
              {
                "color": "#54745A",
                "size": "xl",
                "text": "2/3",
                "type": "text",
                "weight": "bold",
              },
              {
                "color": "#66685F",
                "size": "sm",
                "text": "完成三筆後，就能建立你的日常基準。",
                "type": "text",
                "wrap": true,
              },
            ],
            "layout": "vertical",
            "spacing": "md",
            "type": "box",
          },
          "type": "bubble",
        },
        "type": "flex",
      }
    `);
});
