import yaml
import asyncio
import os
from simple_term_menu import TerminalMenu
from project.did_utils import create_wallet_did, get_stored_did_verkey, solve_did_challenge, build_client_wallet

WALLET_PATH = os.path.abspath(os.path.join("project", "development", 'mock_did_wallet.yaml'))

menu_entries = [
    "Create new DID",
    "Create DID from seed",
    "Show current DID and verkey",
    "Solve challenge",
    "Exit"
]


def create_seed_did():
    with open(WALLET_PATH, "r") as mock_data_content:
        mock_wallet = yaml.load(mock_data_content, Loader=yaml.SafeLoader)
    back_wallet = create_wallet_did(build_client_wallet(WALLET_PATH), seed=mock_wallet['seed'])
    print("DID: ",back_wallet['did'])
    print("Verkey: ", back_wallet['verkey'])


def create_did():
    back_wallet = create_wallet_did(build_client_wallet(WALLET_PATH))
    print("DID: ", back_wallet['did'])
    print("Verkey: ", back_wallet['verkey'])


def print_did_verkey():
    client_wallet = build_client_wallet(WALLET_PATH)
    did, verkey = get_stored_did_verkey(client_wallet['name'])
    print('DID: ', did)
    print('verkey: ', verkey)


def solve_challenge(client_challenge):
    print('\n... Solve challenge ', client_challenge)
    proof = solve_did_challenge(build_client_wallet(WALLET_PATH), client_challenge)
    print("Client proof: ", proof)


if __name__ == '__main__':
    terminal_menu = TerminalMenu(menu_entries)
    print("... Manage DID just for testing!!! NOT SECURE ...\n")
    choice_index = terminal_menu.show()
    if menu_entries[choice_index] == menu_entries[0]:
        create_did()
    elif menu_entries[choice_index] == menu_entries[1]:
        create_seed_did()
    elif menu_entries[choice_index] == menu_entries[2]:
        print_did_verkey()
    elif menu_entries[choice_index] == menu_entries[3]:
        challenge = input("Insert challenge:")
        solve_challenge(challenge)
    elif menu_entries[choice_index] == menu_entries[4]:
        print("Bye bye")
        exit()
