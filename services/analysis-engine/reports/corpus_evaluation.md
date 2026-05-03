# Corpus Evaluation

- Generated at: `2026-04-28T16:20:11.207228+00:00`
- Golden set: `C:\Users\user\Documents\Codex\вайбкод\contract-risk-scan\services\analysis-engine\tests\golden_set\cases.json`
- Results dir: `C:\Users\user\Documents\Codex\вайбкод\contract-risk-scan\services\analysis-engine\artifacts\corpus_results_iter2`
- Cases: `88`
- HIGH risk precision: `86.42%`
- HIGH risk recall: `89.74%`
- Contract type accuracy: `98.86%`

## Extractors

- `binary:utf8_decode`: `15`
- `html:regex`: `73`

## Top False Positives

- `vague_material_breach`: `3`
- `strict_deadlines_without_dependency_carveout`: `1`
- `one_sided_penalty`: `1`
- `unilateral_termination_no_cause`: `1`
- `no_warranty_period`: `1`
- `long_payment_delay_no_security`: `1`
- `payment_asymmetry`: `1`
- `undefined_acceptance_criteria`: `1`
- `royalty_reduction_unclear`: `1`

## Top False Negatives

- `one_sided_penalty`: `4`
- `ip_transfer_without_scope`: `2`
- `strict_deadlines_without_dependency_carveout`: `2`

## Case Detail

- `commission_ru` precision=`1.00` recall=`0.50` fp=[] fn=['one_sided_penalty']
- `household_contract_ru` precision=`0.71` recall=`1.00` fp=['strict_deadlines_without_dependency_carveout', 'vague_material_breach'] fn=[]
- `service_agreement_saas_ru` precision=`0.71` recall=`1.00` fp=['one_sided_penalty', 'unilateral_termination_no_cause'] fn=[]
- `ip_license_ru` precision=`0.00` recall=`0.00` fp=['no_warranty_period'] fn=['ip_transfer_without_scope']
- `supply_ru` precision=`0.40` recall=`1.00` fp=['long_payment_delay_no_security', 'payment_asymmetry', 'undefined_acceptance_criteria'] fn=[]
- `dogovory_4__obrazets_dogovor_komissii_na_pokupku_valyuti` precision=`1.00` recall=`0.50` fp=[] fn=['one_sided_penalty']
- `dogovory_4__obrazets_dogovor_komissii_na_sovershenie_sdelki_po_prodazhe_imus` precision=`1.00` recall=`0.50` fp=[] fn=['one_sided_penalty']
- `dogovory_4__primerniy_litsenzionniy_dogovor_obschego_tipa` precision=`0.00` recall=`0.00` fp=['royalty_reduction_unclear'] fn=['one_sided_penalty']
- `dogovory_4__dogovor_o_poryadke_obsluzhivaniya_dokumentooborota_po_valyutnomu` precision=`1.00` recall=`0.50` fp=[] fn=['ip_transfer_without_scope', 'strict_deadlines_without_dependency_carveout']
- `dogovory_4__dogovor_na_raschetnokassovoe_obsluzhivanie_dogovor_raschetnogo_s` precision=`0.83` recall=`1.00` fp=['vague_material_breach'] fn=[]
- `dogovory_4__dogovor_ob_ustanovlenii_korrespondentskih_otnosheniy_dogovor_kor` precision=`0.83` recall=`1.00` fp=['vague_material_breach'] fn=[]
- `dogovory_4__obrazets_dogovor_poruchenie_na_kuplyuprodazhu_tovara` precision=`1.00` recall=`0.80` fp=[] fn=['strict_deadlines_without_dependency_carveout']
