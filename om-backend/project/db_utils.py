import yaml
import os
from flask_sqlalchemy import SQLAlchemy
from project.authorization_server import AuthorizationServer


def load_server_config():
    config_class = os.environ.get("CONFIG", "BaseConfig")

    import importlib
    module = importlib.import_module("project.config")
    config_instance = getattr(module, config_class)

    return config_instance()


def _populate_mocked_db_and_pds(db: SQLAlchemy, mocked_data_path: str, auth_server=None):
    with open(mocked_data_path, "r") as mock_data_content:
        mock_data = yaml.load(mock_data_content, Loader=yaml.SafeLoader)
    owners_data = mock_data.get("smart_locker_owners")
    lockers_data = mock_data.get("smart_lockers")
    for owner_entry in owners_data:
        owner_model_entry = _create_owner_entry_from_mock_data_entry(owner_entry)
        db.session.add(owner_model_entry)
        if auth_server is AuthorizationServer:
            auth_server.add_did(owner_entry.get("did"), owner_entry.get("verkey"))

    for locker_entry in lockers_data:
        locker_model_entry = _create_locker_entry_from_mock_data_entry(locker_entry)
        db.session.add(locker_model_entry)
    db.session.commit()


def _create_owner_entry_from_mock_data_entry(entry):
    from project.models.smartLockerOwner import SmartLockerOwner
    return SmartLockerOwner(id=entry.get("id"), did=entry.get("did"), name=entry.get("name"), address=entry.get("address"), description=entry.get("description"), url=entry.get("url"), logo=entry.get("logo"), phone=entry.get("phone"))


def _create_locker_entry_from_mock_data_entry(entry):
    from project.models.smartLocker import SmartLocker
    locker = SmartLocker(id=entry.get("id"), name=entry.get("name"), description=entry.get("description"), lat=entry.get("lat"), lon=entry.get("lon"), loc_description=entry.get("loc_description"), icon_image=entry.get("icon_image"), lock_mechanism=entry.get("lock_mechanism"), owner_id=entry.get("owner_id"), chain_id=entry.get("chain_id"), marketplace_smart_contract_address=entry.get("marketplace_smart_contract_address"))
    locker.additional_images = "\n".join(entry.get("additional_images")) if entry.get("additional_images") else None
    return locker
