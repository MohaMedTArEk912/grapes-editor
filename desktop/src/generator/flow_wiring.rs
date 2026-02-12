//! Flow wiring resolver and trigger enforcement.
//!
//! This module validates that every logic flow has an executable runtime path,
//! resolves effective triggers (including auto-migration for legacy manual
//! bindings), and provides normalized maps used by generators.

use std::collections::HashMap;

use crate::schema::logic_flow::{FlowContext, LogicFlowSchema, TriggerType};
use crate::schema::ProjectSchema;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ScheduleBinding {
    pub flow_id: String,
    pub cron: String,
}

#[derive(Debug, Clone, Default)]
pub struct FlowWiring {
    pub event_map: HashMap<String, String>,
    pub api_map: HashMap<String, String>,
    pub mount_map: HashMap<String, Vec<String>>,
    pub schedule: Vec<ScheduleBinding>,
    pub manual_flow_ids: Vec<String>,
    pub effective_triggers: HashMap<String, TriggerType>,
}

impl FlowWiring {
    pub fn event_key(block_id: &str, event_name: &str) -> String {
        format!("{block_id}:{event_name}")
    }

    pub fn flow_for_event(&self, block_id: &str, event_name: &str) -> Option<&str> {
        let key = Self::event_key(block_id, event_name);
        self.event_map.get(&key).map(|s| s.as_str())
    }

    pub fn flow_for_api(&self, api_id: &str) -> Option<&str> {
        self.api_map.get(api_id).map(|s| s.as_str())
    }

    pub fn mount_flow_ids_for(&self, component_id: &str) -> Vec<String> {
        self.mount_map
            .get(component_id)
            .cloned()
            .unwrap_or_default()
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
enum BindingRef {
    Event { block_id: String, event: String },
    Api { api_id: String },
}

pub struct FlowWiringResolver;

impl FlowWiringResolver {
    pub fn resolve(project: &ProjectSchema) -> Result<FlowWiring, String> {
        let mut flow_by_id: HashMap<String, &LogicFlowSchema> = HashMap::new();
        for flow in project.logic_flows.iter().filter(|f| !f.archived) {
            flow_by_id.insert(flow.id.clone(), flow);
        }

        let mut references: HashMap<String, Vec<BindingRef>> = HashMap::new();
        let mut event_map: HashMap<String, String> = HashMap::new();
        let mut api_map: HashMap<String, String> = HashMap::new();

        // Block event bindings
        for block in project
            .blocks
            .iter()
            .chain(project.components.iter())
            .filter(|b| !b.archived)
        {
            let mut events: Vec<(&String, &String)> = block.events.iter().collect();
            events.sort_by(|(a, _), (b, _)| a.cmp(b));

            for (event_name, raw_flow_id) in events {
                let flow_id = raw_flow_id.trim();
                if flow_id.is_empty() {
                    continue;
                }

                let flow = flow_by_id.get(flow_id).ok_or_else(|| {
                    format!(
                        "Event binding '{}' on block '{}' references missing flow '{}'",
                        event_name, block.id, flow_id
                    )
                })?;

                if flow.context != FlowContext::Frontend {
                    return Err(format!(
                        "Event binding '{}:{}' references non-frontend flow '{}'",
                        block.id, event_name, flow_id
                    ));
                }

                let key = FlowWiring::event_key(&block.id, event_name);
                if let Some(existing) = event_map.get(&key) {
                    if existing != flow_id {
                        return Err(format!(
                            "Conflicting event wiring for '{}': '{}' vs '{}'",
                            key, existing, flow_id
                        ));
                    }
                } else {
                    event_map.insert(key, flow_id.to_string());
                }

                references
                    .entry(flow_id.to_string())
                    .or_default()
                    .push(BindingRef::Event {
                        block_id: block.id.clone(),
                        event: event_name.clone(),
                    });
            }
        }

        // API bindings
        let mut apis: Vec<_> = project.apis.iter().filter(|a| !a.archived).collect();
        apis.sort_by(|a, b| a.id.cmp(&b.id));

        for api in apis {
            let Some(raw_flow_id) = api.logic_flow_id.as_deref() else {
                continue;
            };
            let flow_id = raw_flow_id.trim();
            if flow_id.is_empty() {
                continue;
            }

            let flow = flow_by_id.get(flow_id).ok_or_else(|| {
                format!(
                    "API '{}' references missing logic flow '{}'",
                    api.id, flow_id
                )
            })?;

            if flow.context != FlowContext::Backend {
                return Err(format!(
                    "API '{}' references non-backend flow '{}'",
                    api.id, flow_id
                ));
            }

            api_map.insert(api.id.clone(), flow_id.to_string());
            references
                .entry(flow_id.to_string())
                .or_default()
                .push(BindingRef::Api {
                    api_id: api.id.clone(),
                });
        }

        let mut mount_map: HashMap<String, Vec<String>> = HashMap::new();
        let mut schedule: Vec<ScheduleBinding> = Vec::new();
        let mut manual_flow_ids: Vec<String> = Vec::new();
        let mut effective_triggers: HashMap<String, TriggerType> = HashMap::new();

        let mut flows: Vec<_> = flow_by_id.values().copied().collect();
        flows.sort_by(|a, b| a.id.cmp(&b.id));

        for flow in flows {
            let refs = references.get(&flow.id).cloned().unwrap_or_default();
            let effective = match &flow.trigger {
                TriggerType::Manual => {
                    if refs.len() == 1 {
                        match &refs[0] {
                            BindingRef::Event { block_id, event } => TriggerType::Event {
                                component_id: block_id.clone(),
                                event: event.clone(),
                            },
                            BindingRef::Api { api_id } => TriggerType::Api {
                                api_id: api_id.clone(),
                            },
                        }
                    } else {
                        TriggerType::Manual
                    }
                }
                TriggerType::Event {
                    component_id,
                    event,
                } => {
                    if flow.context != FlowContext::Frontend {
                        return Err(format!(
                            "Flow '{}' uses event trigger but context is not frontend",
                            flow.id
                        ));
                    }

                    if project.find_block(component_id).is_none() {
                        return Err(format!(
                            "Flow '{}' references missing event component/block '{}'",
                            flow.id, component_id
                        ));
                    }

                    let is_wired = refs.iter().any(|r| {
                        matches!(
                            r,
                            BindingRef::Event { block_id, event: e }
                            if block_id == component_id && e == event
                        )
                    });

                    if !is_wired {
                        return Err(format!(
                            "Flow '{}' has event trigger '{}:{}' but no runtime event binding exists",
                            flow.id, component_id, event
                        ));
                    }
                    flow.trigger.clone()
                }
                TriggerType::Api { api_id } => {
                    if flow.context != FlowContext::Backend {
                        return Err(format!(
                            "Flow '{}' uses API trigger but context is not backend",
                            flow.id
                        ));
                    }

                    let api = project.find_api(api_id).ok_or_else(|| {
                        format!("Flow '{}' references missing API '{}'", flow.id, api_id)
                    })?;

                    let linked = api
                        .logic_flow_id
                        .as_deref()
                        .map(str::trim)
                        .filter(|s| !s.is_empty());
                    if linked != Some(flow.id.as_str()) {
                        return Err(format!(
                            "Flow '{}' has API trigger '{}' but API is not linked back via logic_flow_id",
                            flow.id, api_id
                        ));
                    }
                    flow.trigger.clone()
                }
                TriggerType::Mount { component_id } => {
                    if flow.context != FlowContext::Frontend {
                        return Err(format!(
                            "Flow '{}' uses mount trigger but context is not frontend",
                            flow.id
                        ));
                    }

                    if !Self::component_exists(project, component_id) {
                        return Err(format!(
                            "Flow '{}' references missing mount target '{}'",
                            flow.id, component_id
                        ));
                    }

                    mount_map
                        .entry(component_id.clone())
                        .or_default()
                        .push(flow.id.clone());
                    flow.trigger.clone()
                }
                TriggerType::Schedule { cron } => {
                    if flow.context != FlowContext::Backend {
                        return Err(format!(
                            "Flow '{}' uses schedule trigger but context is not backend",
                            flow.id
                        ));
                    }
                    if cron.trim().is_empty() {
                        return Err(format!("Flow '{}' has empty schedule cron", flow.id));
                    }
                    schedule.push(ScheduleBinding {
                        flow_id: flow.id.clone(),
                        cron: cron.clone(),
                    });
                    flow.trigger.clone()
                }
            };

            if effective == TriggerType::Manual {
                manual_flow_ids.push(flow.id.clone());
            }
            effective_triggers.insert(flow.id.clone(), effective);
        }

        // Final deterministic sorting
        for flow_ids in mount_map.values_mut() {
            flow_ids.sort();
            flow_ids.dedup();
        }
        manual_flow_ids.sort();
        schedule.sort_by(|a, b| a.flow_id.cmp(&b.flow_id));

        Ok(FlowWiring {
            event_map,
            api_map,
            mount_map,
            schedule,
            manual_flow_ids,
            effective_triggers,
        })
    }

    fn component_exists(project: &ProjectSchema, id: &str) -> bool {
        project.find_page(id).is_some()
            || project.find_component(id).is_some()
            || project.find_block(id).is_some()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::schema::logic_flow::TriggerType;
    use crate::schema::logic_flow::{FlowContext, LogicFlowSchema};
    use crate::schema::BlockType;

    #[test]
    fn auto_migrates_manual_flow_bound_to_single_event() {
        let mut project = ProjectSchema::new("proj-1", "My App");
        let button_id = project
            .blocks
            .iter()
            .find(|b| b.block_type == BlockType::Button && !b.archived)
            .expect("default project should have a button")
            .id
            .clone();

        let flow = LogicFlowSchema::new(
            "flow-event-1",
            "Button click",
            TriggerType::Manual,
            FlowContext::Frontend,
        );
        project.add_logic_flow(flow);
        project
            .find_block_mut(&button_id)
            .expect("button must exist")
            .events
            .insert("onClick".into(), "flow-event-1".into());

        let wiring = FlowWiringResolver::resolve(&project).expect("wiring should resolve");
        let trigger = wiring
            .effective_triggers
            .get("flow-event-1")
            .expect("effective trigger must exist");

        assert_eq!(
            trigger,
            &TriggerType::Event {
                component_id: button_id.clone(),
                event: "onClick".into(),
            }
        );
        assert_eq!(
            wiring.flow_for_event(&button_id, "onClick"),
            Some("flow-event-1")
        );
    }

    #[test]
    fn fails_when_api_trigger_is_not_linked_back() {
        let mut project = ProjectSchema::new("proj-1", "My App");
        let api_id = project.apis[0].id.clone();
        let flow = LogicFlowSchema::new(
            "flow-api-1",
            "API flow",
            TriggerType::Api {
                api_id: api_id.clone(),
            },
            FlowContext::Backend,
        );
        project.add_logic_flow(flow);

        let err = FlowWiringResolver::resolve(&project).expect_err("should fail");
        assert!(err.contains("not linked back"));
    }

    #[test]
    fn validates_mount_context_and_schedule() {
        let mut project = ProjectSchema::new("proj-1", "My App");
        let page_id = project.pages[0].id.clone();

        project.add_logic_flow(LogicFlowSchema::new(
            "flow-mount-1",
            "Mount flow",
            TriggerType::Mount {
                component_id: page_id.clone(),
            },
            FlowContext::Frontend,
        ));
        project.add_logic_flow(LogicFlowSchema::new(
            "flow-schedule-1",
            "Schedule flow",
            TriggerType::Schedule {
                cron: "*/5 * * * *".into(),
            },
            FlowContext::Backend,
        ));

        let wiring = FlowWiringResolver::resolve(&project).expect("wiring should resolve");
        assert_eq!(
            wiring.mount_flow_ids_for(&page_id),
            vec!["flow-mount-1".to_string()]
        );
        assert_eq!(wiring.schedule.len(), 1);
        assert_eq!(wiring.schedule[0].flow_id, "flow-schedule-1");
    }
}
