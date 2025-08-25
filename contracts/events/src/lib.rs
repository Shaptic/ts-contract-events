#![no_std]
use soroban_sdk::{contract, contractevent, contractimpl, IntoVal, String};
use soroban_sdk::{Address, Env, Map, Val, Vec};

#[contractevent]
#[derive(Clone, Debug)]
pub struct DefaultEvent {
    #[topic]
    addr: Address,
    #[topic]
    num: u32,

    bignum: i128,
    nested: Vec<Map<String, i64>>,
    any: Val,
}

#[contract]
pub struct EventEmitter;

#[contractimpl]
impl EventEmitter {
    pub fn emit(env: Env) {
        let mut nested = Vec::new(&env);
        let mut inner = Map::new(&env);

        inner.set("hello".into_val(&env), 27);
        nested.push_back(inner.clone());
        nested.push_back(inner.clone());

        DefaultEvent {
            addr: env.current_contract_address(),
            num: 2,
            bignum: 170141183460469231731687303715884105000,
            nested: nested,
            any: 5_i32.into_val(&env),
        }
        .publish(&env);
    }
}

mod test;
